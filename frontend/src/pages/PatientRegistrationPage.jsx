import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../utils/firebaseInit';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    mrn: '',
    dob: '',
    diabetesType: 'Type 1',
    duration: '',
    conditions: [],
    notes: '',
  });

  const conditionOptions = [
    'Neuropathy',
    'Peripheral Artery Disease',
    'Previous Ulcer',
    'Calluses',
    'Deformity',
    'None',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleConditionToggle = (condition) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter((c) => c !== condition)
        : [...prev.conditions, condition],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const patientRef = await addDoc(collection(db, 'patients'), {
        name: formData.name,
        mrn: formData.mrn,
        dob: formData.dob,
        diabetesType: formData.diabetesType,
        duration: parseInt(formData.duration),
        conditions: formData.conditions,
        notes: formData.notes,
        createdAt: serverTimestamp(),
        doctorId: currentUser.uid,
      });

      toast.success('Patient registered successfully');
      navigate(`/scan/${patientRef.id}`);
    } catch (error) {
      toast.error('Failed to register patient: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen py-12 px-4">

      <div className="relative z-10 max-w-2xl mx-auto">
        <div className="glow-card rounded-lg p-8">
          {/* Header */}
          <h1 className="text-3xl font-bold text-[#10B981] font-mono mb-2">
            NEW PATIENT SCAN
          </h1>
          <p className="text-[#6B7280] font-mono text-sm mb-6">
            Clinical Registration Form
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Full Name */}
            <div>
              <label className="block text-xs font-mono text-[#6B7280] mb-2">
                PATIENT FULL NAME *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input-base w-full"
                required
                disabled={loading}
              />
            </div>

            {/* MRN */}
            <div>
              <label className="block text-xs font-mono text-[#6B7280] mb-2">
                PATIENT ID / MRN *
              </label>
              <input
                type="text"
                name="mrn"
                value={formData.mrn}
                onChange={handleChange}
                className="input-base w-full"
                required
                disabled={loading}
              />
            </div>

            {/* DOB */}
            <div>
              <label className="block text-xs font-mono text-[#6B7280] mb-2">
                DATE OF BIRTH *
              </label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                className="input-base w-full"
                required
                disabled={loading}
              />
            </div>

            {/* Diabetes Type */}
            <div>
              <label className="block text-xs font-mono text-[#6B7280] mb-2">
                DIABETES TYPE *
              </label>
              <select
                name="diabetesType"
                value={formData.diabetesType}
                onChange={handleChange}
                className="input-base w-full"
                required
                disabled={loading}
              >
                <option value="Type 1">Type 1</option>
                <option value="Type 2">Type 2</option>
                <option value="Gestational">Gestational</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-mono text-[#6B7280] mb-2">
                DURATION OF DIABETES (years) *
              </label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                className="input-base w-full"
                min="0"
                required
                disabled={loading}
              />
            </div>

            {/* Conditions */}
            <div>
              <label className="block text-xs font-mono text-[#6B7280] mb-3">
                KNOWN FOOT CONDITIONS
              </label>
              <div className="grid grid-cols-2 gap-3">
                {conditionOptions.map((condition) => (
                  <label
                    key={condition}
                    className="flex items-center cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.conditions.includes(condition)}
                      onChange={() => handleConditionToggle(condition)}
                      disabled={loading}
                      className="w-4 h-4 accent-[#10B981]"
                    />
                    <span className="ml-2 text-sm text-[#1E1B4B] font-mono">
                      {condition}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-mono text-[#6B7280] mb-2">
                DOCTOR NOTES (PRE-SCAN)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="4"
                className="input-base w-full font-mono"
                placeholder="Clinical notes, context, medical history..."
                disabled={loading}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded font-mono bg-[#FAF8FF] border-2 border-[#6B7280] text-[#6B7280] hover:border-[#1E1B4B] hover:text-[#1E1B4B] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 font-bold uppercase"
              >
                {loading ? 'Registering...' : 'Proceed to Scan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
