import { pathForPage, pageFromPath, showsJobTabBar } from './navigation';

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

  test('clients live on the job, and the old global link still resolves', () => {
    expect(pathForPage('client-manager', 'job-kelly')).toBe('/jobs/job-kelly/clients');
    expect(pathForPage('client-manager', null)).toBe('/');
    expect(pageFromPath('/jobs/job-kelly/clients')).toBe('client-manager');
    expect(pageFromPath('/clients')).toBe('client-manager');
  });

  test('the retired budget screen reads as cost plan so the header never flashes not-found', () => {
    expect(pageFromPath('/jobs/job-kelly/budget')).toBe('cost-plan');
    expect(pathForPage('budget-tracking', 'job-kelly')).toBe('/');
  });
});

describe('showsJobTabBar', () => {
  test('only inside an open job', () => {
    expect(showsJobTabBar('dashboard', 'job-kelly')).toBe(true);
    expect(showsJobTabBar('history', 'job-kelly')).toBe(true);
    expect(showsJobTabBar('jobs', 'job-kelly')).toBe(false);
    expect(showsJobTabBar('profile', 'job-kelly')).toBe(false);
    expect(showsJobTabBar('not-found', 'job-kelly')).toBe(false);
    expect(showsJobTabBar('dashboard', null)).toBe(false);
  });
});
