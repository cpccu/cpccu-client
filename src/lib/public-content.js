export const chooseLiveItems = (response, fallback, mapItem) => {
  const items = response?.data;
  return Array.isArray(items) && items.length ? items.map(mapItem) : fallback;
};

export const toPublicContributor = (contributor) => ({
  id: contributor._id || contributor.id,
  name: contributor.name,
  role: contributor.role || "Contributor",
  contribution: contributor.commits
    ? `Contributed ${contributor.commits} commits to the project`
    : "Contributed to the CPCCU platform",
  github: contributor.githubUrl,
  linkedin: contributor.linkedinUrl,
  avatar: contributor.avatarUrl,
});

export const toPublicDonator = (donator) => ({
  id: donator._id || donator.id,
  name: donator.name,
  organization: "CPCCU Supporter",
  contribution: donator.contribution,
  avatar: donator.avatarUrl,
});

export const toPublicEvent = (event) => ({
  id: event._id || event.id,
  img: event.image,
  alt: event.title,
  eventHeadLine1: event.title,
  textContext: event.description,
  eventHeadLine2: "Reward",
  reward: event.reward || "Organized by CPCCU",
  eventHeadLine3: "Event Details",
  rules1: event.location ? `Location: ${event.location}` : "Hosted by CPCCU",
  rules2: event.organizer ? `Organizer: ${event.organizer}` : "",
  rules3: event.type ? `Type: ${event.type}` : "",
  rules4: event.status ? `Status: ${event.status}` : "",
  btnText: event.registrationLink ? "Register" : event.contestLink ? "Open Event" : "",
  btnLink: event.registrationLink || event.contestLink || event.meetLink || "",
  btnText1: event.contestLink ? "Contest Link" : "",
  btnLink1: event.contestLink || "",
  date: event.date,
});

export const toPublicGalleryItem = (item) => ({
  id: item._id || item.id,
  img: item.imageUrl,
  tag: `all ${item.category || "event"}`,
  header: item.title,
  date: new Date(item.uploadedAt || item.createdAt || Date.now()).toLocaleDateString(),
});
