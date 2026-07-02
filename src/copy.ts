// All user-facing wording, kept in one place so it's easy to revise.
// Aim: plain English, no jargon. Created by Nathan Tracey, Sussex Police.

export const APP_TITLE = 'Sussex CCTV Registry';
export const CREATOR_NAME = 'Nathan Tracey';
export const CREATOR_ORG = 'Sussex Police';
export const CREATOR_EMAIL = 'nathan.tracey@sussex.police.uk';
export const CREATOR_CREDIT = `Created by ${CREATOR_NAME} · ${CREATOR_ORG} · ${CREATOR_EMAIL}`;

export const DISCLAIMER_TITLE = 'Before you continue';

export const DISCLAIMER_POINTS: ReadonlyArray<string> = [
  'Do not enter personal data — no names, phone numbers, emails, or exact house numbers. A filter blocks anything that looks personal.',
  'Do not add covert, sensitive, or personally owned cameras (for example Ring doorbells). Public-facing cameras only.',
  'Everyone with access to this OneDrive/SharePoint folder can see and edit the same data. Folder permissions are your access control — manage who can access the folder.',
];

export const CONNECT = {
  pickFolderTitle: 'Connect your OneDrive folder',
  pickFolderBody: 'Choose the folder where the registry should live. The app will read and write a single data file there. OneDrive then shares that file with your team.',
  pickFolderBtn: 'Choose folder',
  fsaNotSupported: 'Your browser cannot pick a folder. Open this file in Chrome or Edge on a laptop.',
};

export const NAV = {
  addCamera: 'Add a camera',
  quickAdd: 'Quick add',
  drawArea: 'Pick an area',
  layers: 'Map layers',
  heatmap: 'Heat map',
  possibleSites: 'Possible sites',
  overview: 'Overview',
  settings: 'Settings',
  signOut: 'Disconnect',
};

export const ACTIONS = {
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  verify: 'Mark as still there',
  exportAll: 'Export all (CSV)',
  exportArea: 'Export this area (CSV)',
  reload: 'Reload latest',
  close: 'Close',
};

export const MESSAGES = {
  remoteChanged: 'Someone on your team just saved an update. Reload to see it.',
  saveConflict: 'A teammate saved while you were editing. Reload and try again.',
  permissionMissing: 'Folder permission was denied. Try again and click Allow.',
  noLocation: 'We couldn\'t find your location. Try moving outside for better signal.',
  feedUrlInvalid: 'Feed link must start with http:// or https://',
};
