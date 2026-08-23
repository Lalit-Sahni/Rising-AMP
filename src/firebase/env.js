export const STAGING_PROJECT_ID = 'rising-amp-staging';
export const PRODUCTION_PROJECT_ID = 'rising-amp-467702-b5';

export const isStagingProject = () =>
  process.env.REACT_APP_FIREBASE_PROJECT_ID === STAGING_PROJECT_ID;

export const isProductionProject = () =>
  process.env.REACT_APP_FIREBASE_PROJECT_ID === PRODUCTION_PROJECT_ID;
