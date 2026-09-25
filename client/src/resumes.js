import { api } from './api.js';

export const RESUME_STORAGE_KEY = 'job-tracker-resumes';

export function readStoredResumes() {
  try {
    const raw = localStorage.getItem(RESUME_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredResumes(resumes) {
  localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resumes));
  return resumes;
}

export async function loadStoredResumes() {
  try {
    const resumes = await api.listResumes();
    saveStoredResumes(resumes);
    return resumes;
  } catch {
    const saved = readStoredResumes();
    return saved;
  }
}

export async function createStoredResume(payload) {
  try {
    const created = await api.createResume(payload);
    const next = [created, ...readStoredResumes().filter((resume) => resume.id !== created.id)];
    saveStoredResumes(next);
    return created;
  } catch {
    const next = [payload, ...readStoredResumes().filter((resume) => resume.id !== payload.id)];
    saveStoredResumes(next);
    return payload;
  }
}

export async function deleteStoredResume(id) {
  try {
    await api.deleteResume(id);
  } catch {
    // Ignore server errors and continue with local cleanup to keep the UI responsive.
  }

  const next = readStoredResumes().filter((resume) => resume.id !== id);
  saveStoredResumes(next);
  return next;
}

export function getResumeById(id) {
  return readStoredResumes().find((resume) => resume.id === id) || null;
}

export function readPdfFileAsDataUrl(file) {
  if (!file) {
    return Promise.reject(new Error('Please choose a PDF file.'));
  }

  if (file.type && !file.type.toLowerCase().includes('pdf')) {
    return Promise.reject(new Error('Only PDF files are supported.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected PDF.'));
    reader.readAsDataURL(file);
  });
}
