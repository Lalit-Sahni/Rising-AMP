import { pathForPage, pageFromPath } from './navigation';

describe('pathForPage', () => {
  test('opening a job overview uses that job id, not a leftover one', () => {
    expect(pathForPage('dashboard', 'job-kelly')).toBe('/jobs/job-kelly');
    expect(pathForPage('dashboard', 'job-78b8dcb3ea6bb3c0')).toBe('/jobs/job-78b8dcb3ea6bb3c0');
  });

  test('jobs home does not keep a job in the URL', () => {
    expect(pathForPage('jobs', 'job-78b8dcb3ea6bb3c0')).toBe('/');
  });

  test('files live on the job', () => {
    expect(pathForPage('files', 'job-78b8dcb3ea6bb3c0')).toBe('/jobs/job-78b8dcb3ea6bb3c0/files');
    expect(pageFromPath('/jobs/job-78b8dcb3ea6bb3c0/files')).toBe('files');
  });

  test('cost plans live on the job', () => {
    expect(pathForPage('cost-plan', 'job-78b8dcb3ea6bb3c0')).toBe('/jobs/job-78b8dcb3ea6bb3c0/cost-plan');
    expect(pageFromPath('/jobs/job-78b8dcb3ea6bb3c0/cost-plan')).toBe('cost-plan');
  });
});
