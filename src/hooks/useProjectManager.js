import { useState, useCallback } from 'react';
import { saveProjectInfo, getProjects, updateProject, deleteProject } from '../firebase/firebaseService';

export const useProjectManager = (accessCode, showToast) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!accessCode) return;
    
    try {
      setLoading(true);
      const result = await getProjects(accessCode);
      
      if (result.success) {
        setProjects(result.projects);
      } else {
        console.error('Failed to load projects:', result.error);
        showToast?.(result.error || 'Failed to load projects', 'error');
        setProjects([]);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      showToast?.('Failed to load projects', 'error');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [accessCode, showToast]);

  const saveProject = useCallback(async (projectData) => {
    if (!accessCode || !projectData.name?.trim()) {
      showToast?.('Project name is required', 'error');
      return { success: false, error: 'Project name is required' };
    }

    try {
      setSubmitting(true);
      const result = await saveProjectInfo(accessCode, projectData);
      
      if (result.success) {
        showToast?.('Project saved successfully', 'success');
        await loadProjects(); // Reload projects after save
        return result;
      } else {
        showToast?.(result.error || 'Failed to save project', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error saving project:', error);
      showToast?.('Failed to save project', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [accessCode, showToast, loadProjects]);

  const updateProjectData = useCallback(async (projectId, projectData) => {
    if (!accessCode || !projectId || !projectData.name?.trim()) {
      showToast?.('Project ID and name are required', 'error');
      return { success: false, error: 'Project ID and name are required' };
    }

    try {
      setSubmitting(true);
      const result = await updateProject(accessCode, projectId, projectData);
      
      if (result.success) {
        showToast?.('Project updated successfully', 'success');
        await loadProjects(); // Reload projects after update
        return result;
      } else {
        showToast?.(result.error || 'Failed to update project', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error updating project:', error);
      showToast?.('Failed to update project', 'error');
      return { success: false, error: error.message };
    } finally {
      setSubmitting(false);
    }
  }, [accessCode, showToast, loadProjects]);

  const removeProject = useCallback(async (projectId) => {
    if (!accessCode || !projectId) {
      showToast?.('Project ID is required', 'error');
      return { success: false, error: 'Project ID is required' };
    }

    try {
      const result = await deleteProject(accessCode, projectId);
      
      if (result.success) {
        showToast?.('Project deleted successfully', 'success');
        await loadProjects(); // Reload projects after delete
        return result;
      } else {
        showToast?.(result.error || 'Failed to delete project', 'error');
        return result;
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      showToast?.('Failed to delete project', 'error');
      return { success: false, error: error.message };
    }
  }, [accessCode, showToast, loadProjects]);

  const searchProjects = useCallback((searchTerm) => {
    if (!searchTerm?.trim()) return projects;
    
    const term = searchTerm.toLowerCase();
    return projects.filter(project =>
      project.name?.toLowerCase().includes(term) ||
      project.description?.toLowerCase().includes(term) ||
      project.location?.toLowerCase().includes(term) ||
      project.client?.toLowerCase().includes(term)
    );
  }, [projects]);

  return {
    projects,
    loading,
    submitting,
    loadProjects,
    saveProject,
    updateProject: updateProjectData,
    removeProject,
    searchProjects
  };
};