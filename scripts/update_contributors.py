import json
import os
import requests
import sys
import time

def load_json(filename):
    try:
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading {filename}: {e}")
    return []

def check_auth():
    """
    Validates that a GitHub token is configured for the contributor fetch.
    Only reports whether the token is configured - never prints its value.
    """
    token = os.getenv('GITHUB_TOKEN')
    if not token:
        print("ERROR: GITHUB_TOKEN is not configured.")
        print("Set the CONTRIBUTOR_GITHUB_TOKEN secret so the workflow can read")
        print("both cpccu/cpccu-client and the private cpccu/cpccu-server repository.")
        sys.exit(1)
    print("GitHub token: configured")

def print_fetch_error(repo, status_code):
    """
    Prints a clear, diagnosable error for a failed repository fetch.
    Never prints the token.
    """
    print(f"ERROR: Failed to fetch contributors from {repo}")
    print(f"HTTP status: {status_code}")
    if status_code == 401:
        print("Authentication failed: the GitHub token is invalid or expired.")
        print("Check that the CONTRIBUTOR_GITHUB_TOKEN secret is configured correctly.")
    elif status_code == 403:
        print("Permission denied: the GitHub token does not have access to this repository.")
        print("Ensure the token has read access to this repository and is not rate limited.")
    elif status_code == 404:
        print("The repository may be private or the GitHub token may not have access.")
        print("Ensure the token has read access to this repository and the branch exists.")
    elif status_code == 429:
        print("Rate limit exceeded. Wait and retry, or check the token's rate limit usage.")
    elif status_code >= 500:
        print("GitHub API server error. Try running the workflow again later.")
    else:
        print("Unexpected error while fetching commits.")

def fetch_contributors_from_branch(repo, branch='release'):
    """
    Fetches contributors and their commit counts for a specific branch.
    Since the /contributors endpoint doesn't support branch filtering,
    we use the /commits endpoint with pagination.

    Exits with a non-zero status if the repository cannot be fetched,
    so the workflow never generates incomplete contributor data.
    """
    url = f"https://api.github.com/repos/{repo}/commits"
    headers = {
        "Accept": "application/vnd.github.v3+json"
    }
    token = os.getenv('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f"token {token}"
    
    params = {
        "sha": branch,
        "per_page": 100
    }
    
    contributor_stats = {}
    page = 1
    
    print(f"Fetching commits for {repo} on branch '{branch}'...")
    
    while True:
        params["page"] = page
        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code != 200:
                print_fetch_error(repo, response.status_code)
                sys.exit(1)
            
            commits = response.json()
            if not commits:
                break
            
            for commit in commits:
                author = commit.get('author')
                if author:
                    login = author['login']
                    if login not in contributor_stats:
                        contributor_stats[login] = {
                            'login': login,
                            'avatar_url': author['avatar_url'],
                            'html_url': author['html_url'],
                            'contributions': 0
                        }
                    contributor_stats[login]['contributions'] += 1
            
            # Check if there's a next page
            if 'next' not in response.links:
                break
            page += 1
            # Simple rate limit safety
            time.sleep(0.1)
            
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Network error fetching commits for {repo}: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: Unexpected exception fetching commits for {repo}: {e}")
            sys.exit(1)
            
    print(f"Successfully fetched {repo} commits.")
    return list(contributor_stats.values())

def main():
    # 0. Validate authentication before fetching anything
    check_auth()

    # 1. Load existing contributors to preserve manual edits
    existing_file = 'data/contributors.json'
    existing_data = load_json(existing_file)
    existing_map = {c['github'].lower().rstrip('/'): c for c in existing_data}

    # 2. Fetch latest contributors from both repos on the 'release' branch
    # Note: Using 'release' branch as requested
    client_contributors = fetch_contributors_from_branch('cpccu/cpccu-client', 'release')
    server_contributors = fetch_contributors_from_branch('cpccu/cpccu-server', 'release')

    # 3. Merge contributors by login
    print("Merging contributors...")
    all_contributors = {}
    
    # LIST OF BOTS TO EXCLUDE
    EXCLUDED_LOGINS = [
        'actions-user', 
        'github-actions[bot]', 
        'github-actions', 
        'dependabot[bot]',
        'github-copilot[bot]',
        'copilot-instructions[bot]',
        'azure-pipelines[bot]'
    ]

    def process_list(contributors):
        for c in contributors:
            login = c['login']
            
            # SKIP BOTS AND AUTOMATED USERS
            # We filter by explicit list, [bot] suffix, and common automation keywords
            if (login.lower() in EXCLUDED_LOGINS or 
                '[bot]' in login.lower() or 
                'actions' in login.lower() or 
                'copilot' in login.lower()):
                continue
                
            github_url = c['html_url'].lower().rstrip('/')
            if github_url in all_contributors:
                all_contributors[github_url]['contributions'] += c['contributions']
            else:
                all_contributors[github_url] = {
                    'name': login,
                    'avatar': c['avatar_url'],
                    'github': c['html_url'],
                    'contributions': c['contributions']
                }

    process_list(client_contributors)
    process_list(server_contributors)

    # 4. Sort by total contributions
    sorted_contributors = sorted(all_contributors.values(), key=lambda x: x['contributions'], reverse=True)

    # 5. Build final list, preserving manual fields
    final_contributors = []
    for i, c in enumerate(sorted_contributors, 1):
        github_url = c['github'].lower().rstrip('/')
        
        # Default values
        role = "Contributor"
        department = "CSE"
        batch = "TBD"
        linkedin = "https://linkedin.com"
        
        # Preserve if exists
        if github_url in existing_map:
            e = existing_map[github_url]
            role = e.get('role', role)
            department = e.get('department', department)
            batch = e.get('batch', batch)
            linkedin = e.get('linkedin', linkedin)
            # Use the name from existing data if it's not just the login
            if e.get('name') and e['name'] != e['github'].split('/')[-1]:
                c['name'] = e['name']

        final_contributors.append({
            "id": i,
            "name": c['name'],
            "role": role,
            "department": department,
            "batch": batch,
            "contribution": f"Contributed {c['contributions']} commits to the project",
            "github": c['github'],
            "linkedin": linkedin,
            "avatar": c['avatar']
        })

    # 6. Save updated data
    os.makedirs(os.path.dirname(existing_file), exist_ok=True)
    with open(existing_file, 'w') as f:
        json.dump(final_contributors, f, indent=2)

    print(f"Successfully updated {len(final_contributors)} contributors in {existing_file}.")

if __name__ == "__main__":
    main()