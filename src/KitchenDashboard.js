import React, { useEffect, useState, useRef } from 'react';

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [accepted, setAccepted] = useState(new Set(JSON.parse(localStorage.getItem('acceptedOrders') || '[]')));
  const [seenOrders, setSeenOrders] = useState(new Set(JSON.parse(localStorage.getItem('seenOrders') || '[]')));
  const [seenMessages, setSeenMessages] = useState(new Set(JSON.parse(localStorage.getItem('seenMessages') || '[]')));
  const [readMessages, setReadMessages] = useState(new Set(JSON.parse(localStorage.getItem('readMessages') || '[]')));
  const [showReadMessages, setShowReadMessages] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedEntries, setArchivedEntries] = useState([]);
  const [now, setNow] = useState(Date.now());
  const alarmAudio = useRef(null);
  const messageAudio = useRef(null);

  // ✅ Location filter
  const LOCATION_ID = 'DELGMT';

  const isChrome = () => {
    const userAgent = navigator.userAgent;
    return /Chrome/.test(userAgent) && !/Edge|Edg|OPR|Brave|Chromium/.test(userAgent);
  };

  const formatDate = (rawDateStr) => {
    if (!rawDateStr) return '';
    let cleanStr = String(rawDateStr);
    if (isChrome()) {
      cleanStr = cleanStr.replace(/\s+at\s+/, ' ').replace(/\s*\([^)]*\)/g, '').trim();
    }
    const d = new Date(cleanStr);
    if (isNaN(d)) return 'Invalid date';
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const getElapsedTime = (rawDateStr) => {
    if (!rawDateStr) return 'Invalid date';
    let cleanStr = String(rawDateStr);
    if (isChrome()) {
      cleanStr = cleanStr.replace(/\s+at\s+/, ' ').replace(/\s*\([^)]*\)/g, '').trim();
    }
    const orderDate = new Date(cleanStr);
    if (isNaN(orderDate)) return 'Invalid date';
    const elapsed = now - orderDate;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s ago`;
  };

  const archiveOldOrders = async () => {
    const res = await fetch('https://privitipizza41-default-rtdb.firebaseio.com/orders.json');
    const data = await res.json();
    if (!data) return;

    const todayStr = formatDate(new Date().toString());

    for (const [id, entry] of Object.entries(data)) {
      if (entry?.locationID !== LOCATION_ID) continue;

      const rawDate = entry['Order Date'] || entry['Message Date'];
      if (!rawDate) continue;
      const entryDateStr = formatDate(rawDate);
      if (entryDateStr === todayStr) continue;

      const archiveCheck = await fetch(`https://privitipizza41-default-rtdb.firebaseio.com/archive/${entryDateStr}/${id}.json`);
      const alreadyArchived = await archiveCheck.json();
      if (alreadyArchived) continue;

      await fetch(`https://privitipizza41-default-rtdb.firebaseio.com/archive/${entryDateStr}/${id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, Archived: true })
      });

      await fetch(`https://privitipizza41-default-rtdb.firebaseio.com/orders/${id}.json`, {
        method: 'DELETE'
      });

      console.log(`📦 Archived ${entry['Order Type'] || 'entry'} ${id} from ${entryDateStr}`);
    }
  };

  useEffect(() => {
    alarmAudio.current = new Audio('/alert.mp3');
    alarmAudio.current.load();
    messageAudio.current = new Audio('/message-alert.mp3');
    messageAudio.current.load();

    messageAudio.current.onplay = () => console.log("🔊 message-alert.mp3 is playing");
    messageAudio.current.onerror = (e) => console.warn("❌ message-alert.mp3 failed to play", e);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!audioEnabled) return;

    const fetchOrders = async () => {
      const res = await fetch('https://privitipizza41-default-rtdb.firebaseio.com/orders.json');
      const data = await res.json();

      let orderArray = Object.entries(data || {}).map(([id, order]) => ({ id, ...order }));
      orderArray = orderArray.filter(o => o?.locationID === LOCATION_ID);

      orderArray.sort((a, b) =>
        new Date(formatDate(b['Order Date'] || b['Message Date'])) -
        new Date(formatDate(a['Order Date'] || a['Message Date']))
      );

      setOrders(orderArray);

      const newUnseenOrder = orderArray.find(order =>
        !seenOrders.has(order.id) &&
        !accepted.has(order.id) &&
        order['Order Type'] !== 'MESSAGE' &&
        order['Order Items']
      );

      if (newUnseenOrder) {
        setSeenOrders(prev => {
          const updated = new Set(prev).add(newUnseenOrder.id);
          localStorage.setItem('seenOrders', JSON.stringify(Array.from(updated)));
          return updated;
        });

        if (alarmAudio.current) {
          alarmAudio.current.currentTime = 0;
          alarmAudio.current.play().catch(err => console.warn("❌ alert.mp3 playback failed", err));
        }
      }

      const newUnseenMessage = orderArray.find(order =>
        order['Order Type'] === 'MESSAGE' && !seenMessages.has(order.id)
      );

      if (newUnseenMessage) {
        setSeenMessages(prev => {
          const updated = new Set(prev).add(newUnseenMessage.id);
          localStorage.setItem('seenMessages', JSON.stringify(Array.from(updated)));
          return updated;
        });

        if (messageAudio.current) {
          messageAudio.current.currentTime = 0;
          messageAudio.current.play().catch(err => console.warn("❌ message-alert.mp3 playback failed", err));
        }
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [audioEnabled, accepted, seenOrders, seenMessages]);

  const acceptOrder = async (id) => {
    const timestamp = new Date().toISOString();
    setAccepted(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('acceptedOrders', JSON.stringify(Array.from(updated)));
      return updated;
    });
    await fetch(`https://privitipizza41-default-rtdb.firebaseio.com/orders/${id}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "Accepted At": timestamp })
    });
  };

  const markMessageAsRead = (id) => {
    setReadMessages(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem('readMessages', JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  if (!audioEnabled) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Orders and Messages Dashboard</h1>
        <p>Please click the button below to start the dashboard and enable sound alerts.</p>
        <p>(c) 2025 RT7 USA Incorporated. All rights reserved.</p>
        <button
          onClick={async () => {
            try {
              await archiveOldOrders();
              setAudioEnabled(true);
              if (alarmAudio.current) {
                alarmAudio.current.play().then(() => alarmAudio.current.pause());
              }
              if (messageAudio.current) {
                messageAudio.current.play().then(() => messageAudio.current.pause());
              }
            } catch (err) {
              console.warn("⚠️ Error during dashboard startup:", err);
            }
          }}
          style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}
        >
          Start Dashboard
        </button>
      </div>
    );
  }

  const today = new Date();
  const todayStr = formatDate(today.toString());

  const displayedOrders = orders.filter(order => {
    const isAcceptedOrder = accepted.has(order.id);
    const isInDateRange = formatDate(order['Order Date']) === todayStr;
    return showAccepted
      ? isAcceptedOrder && isInDateRange && order['Order Type'] !== 'MESSAGE'
      : !isAcceptedOrder && isInDateRange && order['Order Type'] !== 'MESSAGE';
  });

  const displayedMessages = orders.filter(order =>
    order['Order Type'] === 'MESSAGE' &&
    formatDate(order['Message Date']) === todayStr &&
    (showReadMessages ? readMessages.has(order.id) : !readMessages.has(order.id))
  );

  return (
    <div style={{ padding: '1rem', fontFamily: 'Arial' }}>
      <h1>Orders and Messages - Delicacies Gourmet</h1>
      <p><strong>Date:</strong> {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {/* Buttons */}
      <button
        onClick={() => setShowAccepted(prev => !prev)}
        style={{ marginRight: '1rem', backgroundColor: 'red', color: 'white', padding: '0.5rem 1rem' }}
      >
        {showAccepted ? 'Hide Accepted Orders' : 'View Accepted Orders'}
      </button>

      <button
        onClick={() => setShowReadMessages(prev => !prev)}
        style={{ backgroundColor: '#6c757d', color: 'white', padding: '0.5rem 1rem' }}
      >
        {showReadMessages ? 'Hide Read Messages' : 'View Read Messages'}
      </button>

      <button
        onClick={async () => {
          if (!showArchived) {
            const res = await fetch('https://privitipizza41-default-rtdb.firebaseio.com/archive.json');
            const data = await res.json();
            const allArchived = [];
            Object.entries(data || {}).forEach(([dateKey, entries]) => {
              Object.entries(entries).forEach(([id, entry]) => {
                if (entry?.locationID === LOCATION_ID) {
                  allArchived.push({ ...entry, id, archiveDate: dateKey });
                }
              });
            });
            allArchived.sort((a, b) =>
              new Date(b['Order Date'] || b['Message Date']) -
              new Date(a['Order Date'] || a['Message Date'])
            );
            setArchivedEntries(allArchived);
          }
          setShowArchived(prev => !prev);
        }}
        style={{ backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', marginLeft: '1rem' }}
      >
        {showArchived ? 'Hide Archived' : 'Archived'}
      </button>

      {/* Messages */}
      {displayedMessages.map(message => (
        <div key={message.id} style={{ backgroundColor: '#fff3f4', border: '2px solid #ff4081', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
          <h2>📨 {showReadMessages ? 'Read Message' : 'New Message'}</h2>
          <p><strong>Time:</strong> {message['Message Date'] || 'N/A'}</p>
          <p><strong>Caller Name:</strong> {message['Caller_Name'] || 'N/A'}</p>
          <p><strong>Caller Phone:</strong> {message['Caller_Phone'] || 'N/A'}</p>
          <p><strong>Reason:</strong> {message['Message_Reason'] || 'N/A'}</p>
          {!showReadMessages && (
            <button onClick={() => markMessageAsRead(message.id)} style={{ marginTop: '0.5rem', backgroundColor: '#d6336c', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}>Mark As Read</button>
          )}
        </div>
      ))}

      {/* Orders */}
      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {displayedOrders.map(order => (
          <div key={order.id} style={{ backgroundColor: '#e6f9e6', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <h2>Order #{order['Order ID']}</h2>
            <p><strong>Customer:</strong> {order['Customer Name']}</p>
            <p><strong>Phone:</strong> {order['Customer Contact Number'] || 'N/A'}</p>
            <p><strong>Order Type:</strong> {order['Order Type'] || 'N/A'}</p>

            {/* ✅ Status message for PICK UP orders (exact match "PICK UP") */}
            {order['Order Type'] === 'PICK UP' && (() => {
              const status = (order.status || '').toUpperCase().trim();
              let statusMessage = '';
              let statusColor = 'black';

              if (!status || status === 'N/A' || status === 'NOT PAID') {
                statusMessage = 'Order Not Paid';
                statusColor = '#f0ad4e'; // yellow/orange
              } else if (status === 'PENDING') {
                statusMessage = 'Customer Completing Payment - Stand By';
                statusColor = '#ffc107'; // amber
              } else if (status === 'PAID') {
                statusMessage = 'Customer Has Completed Payment - Proceed with Order';
                statusColor = '#28a745'; // green
              } else if (status === 'CANCELED' || status === 'FAILED') {
                statusMessage = 'Payment Failed - Contact the Customer to Confirm Order';
                statusColor = '#dc3545'; // red
              }

              return (
                <p style={{ color: statusColor, fontWeight: 'bold', marginTop: '0.5rem' }}>
                  <strong>Status:</strong> {statusMessage}
                </p>
              );
            })()}

            <p><strong>Order Date:</strong> {order['Order Date']}</p>
            {!showAccepted && order['Order Date'] && (
              <p><strong>Elapsed Time:</strong> <span style={{ color: 'goldenrod' }}>{getElapsedTime(order['Order Date'])}</span></p>
            )}
            {showAccepted && order['Accepted At'] && (
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                <strong>Accepted At:</strong> {new Date(order['Accepted At']).toLocaleString()}
              </p>
            )}
            <p style={{ color: 'red', fontWeight: 'bold' }}><strong>Pickup Time:</strong> {order['Pickup Time']}</p>
            <p><strong>Total:</strong> {order['Total Price']}</p>
            <ul>
              {order['Order Items']?.split(',').map((item, index) => (
                <li key={index}>{item.trim()}</li>
              ))}
            </ul>
            {!accepted.has(order.id) && (
              <button
                onClick={() => acceptOrder(order.id)}
                style={{
                  marginTop: '1rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '4px'
                }}
              >
                ACCEPT
              </button>
            )}
          </div>
        ))}
      </div>

      {showArchived && (
        <div style={{ marginTop: '2rem' }}>
          <h2>📦 Archived Orders & Messages</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {archivedEntries.map(entry => (
              <div key={entry.id} style={{ backgroundColor: '#f0f0f0', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px' }}>
                <h3>{entry['Order Type'] === 'MESSAGE' ? '📨 Message' : `Order #${entry['Order ID'] || entry.id}`}</h3>
                <p><strong>Date:</strong> {entry['Order Date'] || entry['Message Date'] || 'N/A'}</p>
                {entry['Order Type'] === 'MESSAGE' ? (
                  <>
                    <p><strong>Caller Name:</strong> {entry['Caller_Name']}</p>
                    <p><strong>Caller Phone:</strong> {entry['Caller_Phone']}</p>
                    <p><strong>Reason:</strong> {entry['Message_Reason']}</p>
                  </>
                ) : (
                  <>
                    <p><strong>Customer:</strong> {entry['Customer Name']}</p>
                    <p><strong>Phone:</strong> {entry['Customer Contact Number'] || 'N/A'}</p>
                    <p><strong>Order Type:</strong> {entry['Order Type']}</p>
                    {entry['Order Type']?.toLowerCase() === 'delivery' && (
                      <>
                        <p><strong>Delivery Address:</strong> {entry['Delivery Address']}</p>
                        <p><strong>Order Instructions:</strong> {entry['Order Instructions'] || 'N/A'}</p>
                        <p><strong>Status:</strong> {entry.Status || 'N/A'}</p>
                        <p><strong>Paid At:</strong> {entry.PaidAt || 'N/A'}</p>
                        <p><strong>Payment ID:</strong> {entry.paymentIntentId || 'N/A'}</p>
                        <p><strong>Checkout Session ID:</strong> {entry.checkoutSessionId || 'N/A'}</p>
                      </>
                    )}
                    {entry['Order Type']?.toLowerCase() !== 'delivery' && entry['Delivery Address'] && (
                      <p><strong>Delivery Address:</strong> {entry['Delivery Address']}</p>
                    )}
                    <p><strong>Pickup Time:</strong> {entry['Pickup Time']}</p>
                    <p><strong>Total:</strong> {entry['Total Price']}</p>
                    <ul>
                      {entry['Order Items']?.split(',').map((item, index) => (
                        <li key={index}>{item.trim()}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
