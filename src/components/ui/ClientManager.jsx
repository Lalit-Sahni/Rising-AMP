import React, { useState } from 'react';
import {
  User,
  Plus,
  Edit,
  Trash2,
  Search,
  MapPin,
  Phone,
  Mail,
  Building,
  Save,
  X,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useClientManager } from '../../hooks/useClientManager';

const fieldClass =
  'w-full px-3.5 py-[10px] bg-surface border border-hairline rounded-ot-sm text-[13.5px] text-ink placeholder-slate-400 focus:outline-none focus:border-accent';

const iconBtn =
  'p-2 rounded-ot-sm border border-hairline text-slate-600 hover:text-ink hover:bg-canvas transition-colors';

const ClientManager = ({ isOpen, onClose, onClientSelect, embedded = false }) => {
  const { showToast, jobId, orgId } = useApp();
  const active = embedded || isOpen;
  const {
    loading,
    submitting,
    saveClient,
    updateClient,
    removeClient,
    searchClients,
  } = useClientManager(jobId, showToast, orgId, active);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    company: '',
    abn: '',
    notes: '',
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      company: '',
      abn: '',
      notes: '',
    });
    setEditingClient(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      showToast('Client name is required', 'error');
      return;
    }

    try {
      let result;

      if (editingClient) {
        result = await updateClient(editingClient.id, formData);
      } else {
        result = await saveClient(formData);
      }

      if (result.success) {
        resetForm();
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      company: client.company || '',
      abn: client.abn || '',
      notes: client.notes || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (clientId) => {
    if (window.confirm('Remove this client from the job? The record stays; they will no longer show in the list.')) {
      await removeClient(clientId);
    }
  };

  const handleSelectClient = (client) => {
    if (onClientSelect) {
      onClientSelect(client);
    }
    if (onClose) onClose();
  };

  const filteredClients = searchClients(searchTerm);

  if (!active) return null;

  const header = (
    <div className={`flex items-center justify-between gap-3 ${embedded ? 'mb-4' : 'p-4 md:px-6 md:py-5 border-b border-hairline'}`}>
      <div>
        {embedded ? (
          <>
            <div className="eyebrow">Directory</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Clients</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">People you bill on this job.</p>
          </>
        ) : (
          <>
            <h2 className="text-[18px] font-extrabold text-ink">Clients</h2>
            <p className="text-[13px] text-slate-400">People you bill on this job</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] py-[9px] rounded-ot-sm"
        >
          <Plus className="w-4 h-4" />
          Add client
        </button>
        {!embedded && (
          <button type="button" onClick={onClose} className={iconBtn} title="Close">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const form = (
    <div className={embedded ? 'bg-surface border border-hairline rounded-ot p-5 shadow-whisper' : 'h-full overflow-auto p-4 md:p-6'}>
      <div className={embedded ? '' : 'bg-canvas border border-hairline rounded-ot p-5'}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-ink">
            {editingClient ? 'Edit client' : 'Add client'}
          </h3>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(false);
              resetForm();
            }}
            className={iconBtn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">
                  Client name <span className="text-neg">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={fieldClass}
                  placeholder="Enter client name"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">Company name</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => handleInputChange('company', e.target.value)}
                  className={fieldClass}
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">ABN</label>
                <input
                  type="text"
                  value={formData.abn}
                  onChange={(e) => handleInputChange('abn', e.target.value)}
                  className={fieldClass}
                  placeholder="Enter ABN"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={fieldClass}
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={fieldClass}
                  placeholder="+61 400 000 000"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows="3"
              className={fieldClass}
              placeholder="Enter full address"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows="3"
              className={fieldClass}
              placeholder="Anything else about this client"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-hairline">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
              className="px-4 py-[9px] rounded-ot-sm border border-hairline text-[13px] font-semibold text-ink hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-[9px] rounded-ot-sm bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editingClient ? 'Update client' : 'Save client'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const list = (
    <div className={embedded ? '' : 'h-full overflow-auto p-4 md:p-6'}>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search clients…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`${fieldClass} pl-10`}
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent mx-auto" />
          <p className="text-[13px] text-slate-400 mt-3">Loading clients…</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-ot bg-surface">
          <User className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-[13.5px] text-slate-600 mb-4">
            {searchTerm ? 'No clients match that search.' : 'No clients on this job yet.'}
          </p>
          {!searchTerm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] py-[9px] rounded-ot-sm"
            >
              Add your first client
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-surface rounded-ot p-4 border border-hairline hover:border-[#D6D9DD] shadow-whisper"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-[15px] font-bold text-ink">{client.name}</h3>
                    {client.company && (
                      <span className="px-1.5 py-0.5 bg-canvas text-slate-600 text-[11px] font-semibold rounded-ot-sm border border-hairline">
                        {client.company}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[13px] text-slate-600">
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {client.phone}
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2 md:col-span-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{client.address}</span>
                      </div>
                    )}
                    {client.abn && (
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        ABN: {client.abn}
                      </div>
                    )}
                  </div>

                  {client.notes && (
                    <div className="mt-2 p-2.5 bg-canvas border border-hairline rounded-ot-sm">
                      <p className="text-[13px] text-slate-600">{client.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {onClientSelect && (
                    <button
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      className="p-2 rounded-ot-sm border border-hairline text-pos hover:bg-pos-tint transition-colors"
                      title="Select client"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEdit(client)}
                    className={iconBtn}
                    title="Edit client"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(client.id)}
                    className="p-2 rounded-ot-sm border border-hairline text-neg hover:bg-canvas transition-colors"
                    title="Remove client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const body = (
    <>
      {header}
      <div className={embedded ? '' : 'flex-1 overflow-hidden'}>{showAddForm ? form : list}</div>
    </>
  );

  if (embedded) {
    return <div className="max-w-4xl">{body}</div>;
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-hairline rounded-ot w-full max-w-4xl h-[90vh] flex flex-col shadow-whisper">
        {body}
      </div>
    </div>
  );
};

export default ClientManager;
