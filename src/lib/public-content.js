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

export const toPublicAlumni = (alumni) => ({
  id: alumni._id || alumni.id,
  img: alumni.img || alumni.avatar,
  name: alumni.name,
  position: alumni.position,
  batch: alumni.batch,
  technology: alumni.technology,
  job: alumni.job || {},
  email: alumni.email,
  phone: alumni.phone,
  socials: alumni.socials || {},
});

export const toPublicEvent = (event) => ({
  id: event._id || event.id,
  img: event.image,
  alt: event.title,
  eventHeadLine1: event.eventHeadLine1 || event.title,
  textContext: event.description,
  eventHeadLine2: event.eventHeadLine2 || "Reward",
  reward: event.reward || "Organized by CPCCU",
  eventHeadLine3: event.eventHeadLine3 || "Event Details",
  rules1: event.rules1 || (event.location ? `Location: ${event.location}` : "Hosted by CPCCU"),
  rules2: event.rules2 || (event.organizer ? `Organizer: ${event.organizer}` : ""),
  rules3: event.rules3 || (event.type ? `Type: ${event.type}` : ""),
  rules4: event.rules4 || (event.status ? `Status: ${event.status}` : ""),
  btnText: event.btnText || (event.registrationLink ? "Register" : event.contestLink ? "Open Event" : ""),
  btnLink: event.btnLink || event.registrationLink || event.contestLink || event.meetLink || "",
  btnText1: event.btnText1 || (event.contestLink ? "Contest Link" : ""),
  btnLink1: event.btnLink1 || event.contestLink || "",
  date: event.date,
  endDate: event.endDate,
});

export const toPublicGalleryItem = (item) => ({
  id: item._id || item.id,
  img: item.imageUrl,
  tag: `all ${item.category || "event"}`,
  header: item.title,
  date: new Date(item.uploadedAt || item.createdAt || Date.now()).toLocaleDateString(),
  eventId: item.eventId?._id || item.eventId || null,
  eventTitle: item.eventTitle || (item.eventId && typeof item.eventId === 'object' ? item.eventId.title : null),
  eventDescription: item.eventDescription || (item.eventId && typeof item.eventId === 'object' ? item.eventId.description : null),
});

export const groupGalleryItemsByEvent = (items, eventMap = {}) => {
  const groups = {};
  items.forEach(item => {
    const eventId = item.eventId || 'ungrouped';
    const event = eventMap[eventId];
    if (!groups[eventId]) {
      groups[eventId] = {
        header: event?.title || item.eventTitle || 'Ungrouped Photos',
        conText: event?.description || item.eventDescription || 'Photos from various events.',
        eventDate: event?.eventDate || item.eventDate,
        eventId: eventId === 'ungrouped' ? null : eventId,
        element: [],
      };
    }
    groups[eventId].element.push({
      id: item.id,
      img: item.img,
      header: item.header,
      date: item.date,
    });
  });
  return Object.values(groups);
};

export const toPublicDeveloperProfile = (profile) => ({
  id: profile._id || profile.id,
  img: profile.photoUrl,
  name: profile.name,
  tag: profile.title,
  email: profile.email,
  phone: profile.phone,
  socials: {
    github: profile.githubUrl,
    linkedin: profile.linkedinUrl,
    portfolio: profile.portfolioUrl,
  },
  skills: (profile.skills || []).map((skill) => ({
    skillName: skill.skillName || skill.name,
    experience: skill.experience || skill.description,
  })),
  createdAt: profile.memberSince || profile.submittedAt || profile.createdAt,
});
