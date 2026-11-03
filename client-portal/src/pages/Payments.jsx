import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { IndianRupee, CheckCircle, Clock } from 'lucide-react';
import api from '../lib/api';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await api.get('/payments/mine');
      setPayments(res.data);
    } catch (err) {
      toast.error('Failed to load payment invoices');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (payment) => {
    try {
      // 1. Create Razorpay order on backend
      const orderRes = await api.post('/payments/create-order', {
        eventId: payment.eventId,
      });

      const { orderId, amount, currency, keyId, paymentId } = orderRes.data;

      // 2. Open Razorpay Modal
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: 'NearMe Catering',
        description: `Platform fee: ${payment.boysCount} boys × ₹${payment.ratePerBoy}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              paymentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Payment settled successfully!');
            fetchPayments();
          } catch (verifyErr) {
            toast.error('Payment verification failed');
          }
        },
        theme: {
          color: '#2563eb',
        },
      };

      if (!window.Razorpay) {
        toast.error('Razorpay SDK loading. Please refresh and try again.');
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Platform Settlements & Invoices</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Pay platform commission (₹20/boy) after closing event slots
        </p>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading invoices...</p>
        ) : payments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No payment invoices generated yet.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Event Date</th>
                  <th>Staff Hired</th>
                  <th>Rate</th>
                  <th>Total Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.event.name}</td>
                    <td>{new Date(p.event.date).toLocaleDateString()}</td>
                    <td>{p.boysCount} boys</td>
                    <td>₹{p.ratePerBoy} / boy</td>
                    <td style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--primary)' }}>
                      ₹{p.totalAmount / 100}
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {p.status === 'pending' ? (
                        <button
                          onClick={() => handlePay(p)}
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                        >
                          <IndianRupee size={14} /> Pay via Razorpay
                        </button>
                      ) : (
                        <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.875rem' }}>
                          ✓ Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
