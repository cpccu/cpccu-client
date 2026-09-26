import 'server-only';

import { Project } from '@/lib/server/models/project.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';

/**
 * Port of `cpccu-server/src/controllers/project.controller.js`.
 *
 * Two "public" and "private" paths over the same collection, and the difference
 * between them is entirely in how the OWNER is identified:
 *  - the private paths (`getProjects`, `createProject`, `updateProject`,
 *    `deleteProject`) scope every query to `req.user._id`, so a member can only
 *    ever see and touch their own projects;
 *  - `getPublicProjects` is scoped to a `:userId` route parameter and is
 *    UNAUTHENTICATED — it is the portfolio on a public profile page.
 * That asymmetry is deliberate and preserved: the public route reads projects
 * whose `category`/`status` the profile page is responsible for filtering
 * client-side, so it returns everything the owner has.
 */

const getProjects = async (req, res) => {
  // Sort is `{ order: 1, createdAt: -1 }` throughout: `order` is the
  // user-draggable position (ascending, lowest first), and `createdAt` breaks
  // ties for projects that share an order value. Newest-first within a position
  // means a newly added project appears above older ones at the same rank rather
  // than below them.
  const projects = await Project.find({ userId: req.user._id }).sort({
    order: 1,
    createdAt: -1,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, projects, 'Projects fetched successfully'));
};

const getPublicProjects = async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new ApiError(400, 'User ID is required');
  }
  // NO `isValidIdentity` check on `userId` here, unlike almost every other
  // handler in this migration. A malformed id is not an error: it simply matches
  // no `userId`, returns an empty array, and the portfolio section renders
  // empty. Preserved verbatim — a profile with no projects and a profile with a
  // bad id look identical to the visitor, which is the desired outcome.
  const projects = await Project.find({ userId }).sort({
    order: 1,
    createdAt: -1,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, projects, 'Projects fetched successfully'));
};

const createProject = async (req, res) => {
  const {
    title,
    description,
    technologies,
    repoUrl,
    liveUrl,
    category,
    status,
  } = req.body;

  // Title is the only required field, and it is trimmed before both the check
  // and the write — a whitespace-only title is a 400, and the stored value never
  // has leading or trailing space, which is what keeps the `order`-sorted list
  // from rendering ragged headings.
  if (!title || !title.trim()) {
    throw new ApiError(400, 'Project title is required');
  }

  // Every optional field is `x || ''` rather than being omitted, so the document
  // always has the same shape and the frontend never has to distinguish
  // "missing" from "empty". `status` defaults to `'active'` rather than
  // `'draft'`, which is the only place in this API where omission is more
  // permissive than the schema default; preserved from the original.
  const project = await Project.create({
    userId: req.user._id,
    title: title.trim(),
    description: description || '',
    technologies: Array.isArray(technologies) ? technologies : [],
    repoUrl: repoUrl || '',
    liveUrl: liveUrl || '',
    category: category || '',
    status: status || 'active',
  });

  return res
    .status(201)
    .json(new ApiResponse(201, project, 'Project created successfully'));
};

const updateProject = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    technologies,
    repoUrl,
    liveUrl,
    category,
    status,
    order,
  } = req.body;

  // OWNERSHIP SCOPED LOOKUP, and this is what makes the endpoint safe: the query
  // is `{ _id: id, userId: req.user._id }`, so a member asking for someone
  // else's project id gets the same 404 as a member asking for a project that
  // does not exist. A 403 here would confirm the id exists, which is a
  // (minor) enumeration leak, and would also let a member learn another user's
  // project layout.
  const project = await Project.findOne({ _id: id, userId: req.user._id });
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  // EVERY field is `!== undefined`, not a truthiness test. A partial update must
  // be able to CLEAR a field — `description: ''` has to actually clear the
  // description, and `order: 0` has to be settable (a truthiness test would
  // silently ignore position 0, which is the FIRST position in the
  // `{ order: 1 }` sort). `title` is the one field that is still trimmed, so a
  // whitespace-only title is stored as an empty string here rather than
  // rejected — an inconsistency with `createProject` that exists in the original.
  const updateData = {};
  if (title !== undefined) updateData.title = title.trim();
  if (description !== undefined) updateData.description = description;
  if (technologies !== undefined) updateData.technologies = technologies;
  if (repoUrl !== undefined) updateData.repoUrl = repoUrl;
  if (liveUrl !== undefined) updateData.liveUrl = liveUrl;
  if (category !== undefined) updateData.category = category;
  if (status !== undefined) updateData.status = status;
  if (order !== undefined) updateData.order = order;

  // `findByIdAndUpdate` on the BARE id rather than re-using the scoped
  // `project._id` query. Safe because the ownership check above already
  // established that this id belongs to the caller; `new: true` returns the
  // post-update document.
  const updated = await Project.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updated, 'Project updated successfully'));
};

const deleteProject = async (req, res) => {
  const { id } = req.params;
  // Same ownership-scoped atomic delete as the update path's lookup: a member
  // cannot delete another member's project, and cannot tell that they tried.
  const project = await Project.findOneAndDelete({
    _id: id,
    userId: req.user._id,
  });
  if (!project) {
    throw new ApiError(404, 'Project not found');
  }
  // Note the asymmetry with the update path: the response body is `null` here
  // and the deleted document there. Preserved — clients differ on this endpoint
  // and normalising it would change one of them.
  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Project deleted successfully'));
};

export {
  createProject,
  deleteProject,
  getProjects,
  getPublicProjects,
  updateProject,
};
