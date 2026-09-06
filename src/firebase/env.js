import { firebaseProjectId } from '../env';

export const STAGING_PROJECT_ID = 'rising-amp-staging';
export const PRODUCTION_PROJECT_ID = 'rising-amp-467702-b5';

export const isStagingProject = () => firebaseProjectId() === STAGING_PROJECT_ID;

export const isProductionProject = () => firebaseProjectId() === PRODUCTION_PROJECT_ID;
