import json
import os
import requests

def load_json(filename):
    try:
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading {filename}: {e}")
    return []

def fetch_contributors(repo):
    url = f"https://api.github.com/repos/{repo}/contributors"
    headers = {
        "Accept": "application/vnd.github.v3+json"
    }
    token = os.getenv('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f"token {token}"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Error fetching {repo}: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"Exception fetching {repo}: {e}")
        return []

def main():
    # 1. Load existing contributors to preserve manual edits
    existing_file = 'data/contributors.json'
    existing_data = load_json(existing_file)
    existing_map = {c['github'].lower().rstrip('/'): c for c in existing_data}

    # 2. Fetch latest contributors from both repos
    client_contributors = fetch_contributors('cpccu/cpccu-client')
    server_contributors = fetch_contributors('cpccu/cpccu-server')

    # 3. Merge contributors by login
    all_contributors = {}

    def process_list(contributors):
        for c in contributors:
            login = c['login']
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
