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

  // ✅ PRINTING (Sunmi V2 Pro, strict 58mm)
  const escapeHtml = (s) => {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const buildPickupStatusLine = (order) => {
    const status = (order?.status || '').toUpperCase().trim();
    if (!status || status === 'N/A' || status === 'NOT PAID') return 'NOT PAID';
    if (status === 'PENDING') return 'PENDING (Customer paying)';
    if (status === 'PAID') return 'PAID';
    if (status === 'CANCELED' || status === 'FAILED') return 'PAYMENT FAILED';
    return status;
  };

  const buildReceiptHtml = (entry) => {
    const isMessage = entry?.['Order Type'] === 'MESSAGE';
    const orderType = entry?.['Order Type'] || 'N/A';

    const title = isMessage ? 'MESSAGE' : 'ORDER';
    const orderNumberLine = isMessage
      ? `Message ID: ${escapeHtml(entry?.id || '')}`
      : `Order #: ${escapeHtml(entry?.['Order ID'] || entry?.id || '')}`;

    const timeLine = escapeHtml(entry?.['Order Date'] || entry?.['Message Date'] || '');
    const customerName = escapeHtml(isMessage ? entry?.['Caller_Name'] : entry?.['Customer Name']);
    const phone = escapeHtml(isMessage ? entry?.['Caller_Phone'] : entry?.['Customer Contact Number']);
    const total = escapeHtml(entry?.['Total Price']);
    const pickupTime = escapeHtml(entry?.['Pickup Time']);
    const deliveryAddress = escapeHtml(entry?.['Delivery Address']);
    const instructions = escapeHtml(entry?.['Order Instructions']);
    const reason = escapeHtml(entry?.['Message_Reason']);

    const items = (entry?.['Order Items'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => `<div class="item">• ${escapeHtml(x)}</div>`)
      .join('');

    const pickupStatusBlock =
      !isMessage && String(orderType).toUpperCase() === 'PICK UP'
        ? `<div class="row"><span class="label">STATUS:</span><span class="value">${escapeHtml(buildPickupStatusLine(entry))}</span></div>`
        : '';

    const deliveryBlock =
      !isMessage && String(orderType).toLowerCase() === 'delivery'
        ? `
          <div class="hr"></div>
          <div class="label">DELIVERY ADDRESS</div>
          <div class="wrap">${deliveryAddress || 'N/A'}</div>
          <div class="label" style="margin-top:6px;">INSTRUCTIONS</div>
          <div class="wrap">${instructions || 'N/A'}</div>
        `
        : '';

    const pickupBlock =
      !isMessage && String(orderType).toUpperCase() === 'PICK UP'
        ? `
          <div class="hr"></div>
          <div class="label">PICKUP TIME</div>
          <div class="big">${pickupTime || 'N/A'}</div>
        `
        : '';

    const messageBlock =
      isMessage
        ? `
          <div class="hr"></div>
          <div class="label">REASON</div>
          <div class="wrap">${reason || 'N/A'}</div>
        `
        : '';

    const itemsBlock =
      !isMessage
        ? `
          <div class="hr"></div>
          <div class="label">ITEMS</div>
          <div class="items">${items || '<div class="item">N/A</div>'}</div>
        `
        : '';

    const totalBlock =
      !isMessage
        ? `
          <div class="hr"></div>
          <div class="row">
            <span class="label">TOTAL</span>
            <span class="big">${total || 'N/A'}</span>
          </div>
        `
        : '';

    // ✅ STRICT 58mm + bigger Order # / Type / Customer name
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { margin: 4mm; }
            body {
              font-family: Arial, sans-serif;
              font-size: 11px;
              color: #000;
            }

            /* Strict 58mm-safe width */
            .receipt {
              width: 220px;
            }

            .center { text-align: center; }
            .hr { border-top: 1px dashed #000; margin: 8px 0; }

            .title {
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 0.3px;
            }

            /* Bigger lines requested */
            .orderNo {
              font-size: 15px;
              font-weight: 900;
              margin-top: 6px;
            }

            .typeBig {
              font-size: 14px;
              font-weight: 900;
              margin-top: 4px;
            }

            .customerBig {
              font-size: 14px;
              font-weight: 900;
              margin-top: 2px;
            }

            .label { font-weight: 800; }
            .big { font-size: 14px; font-weight: 900; }

            .row {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              margin: 2px 0;
            }

            .value { font-weight: 700; }

            .items { margin-top: 4px; }
            .item { margin: 2px 0; }

            .mono {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            }

            /* Ensure long lines wrap safely on 58mm */
            .wrap, .item, .mono {
              word-wrap: break-word;
              overflow-wrap: anywhere;
            }

            .footer {
              margin-top: 10px;
              font-size: 10px;
              text-align: center;
            }
          </style>
        </head>
        <body onload="window.print(); setTimeout(()=>window.close(), 300);">
          <div class="receipt">

            <div class="center title">${escapeHtml(title)}</div>

            <div class="center orderNo">${escapeHtml(orderNumberLine)}</div>

            <div class="center typeBig">TYPE: ${escapeHtml(orderType)}</div>

            <div class="hr"></div>

            <div class="label">${isMessage ? 'CALLER' : 'CUSTOMER'}</div>
            <div class="customerBig wrap">${customerName || 'N/A'}</div>

            <div class="row">
              <span class="label">PHONE</span>
              <span class="mono">${phone || 'N/A'}</span>
            </div>

            <div class="row">
              <span class="label">${isMessage ? 'TIME' : 'ORDER TIME'}</span>
              <span class="mono wrap" style="text-align:right;">${timeLine || ''}</span>
            </div>

            ${pickupStatusBlock}
            ${messageBlock}
            ${deliveryBlock}
            ${pickupBlock}
            ${itemsBlock}
            ${totalBlock}

            <div class="hr"></div>
            <div class="footer">© 2026 Avaiaconnects.com</div>
          </div>
        </body>
      </html>
    `;

    return html;
  };

  const printEntry = (entry) => {
    try {
      const html = buildReceiptHtml(entry);
      const w = window.open('', '_blank', 'width=400,height=600');
      if (!w) {
        alert('Pop-up blocked. Please allow pop-ups to print.');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      console.warn('❌ Print failed:', e);
      alert('Print failed. Check browser settings on the POS device.');
    }
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
        <p>(c) 2026 AvaiaConnects.com (RT7 USA Incorporated). All rights reserved.</p>
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

      {/* Control buttons */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>📨 {showReadMessages ? 'Read Message' : 'New Message'}</h2>
            <button
              onClick={() => printEntry(message)}
              style={{ backgroundColor: '#0d6efd', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px' }}
            >
              PRINT
            </button>
          </div>
          <p><strong>Time:</strong> {message['Message Date'] || 'N/A'}</p>
          <p><strong>Caller Name:</strong> {message['Caller_Name'] || 'N/A'}</p>
          <p><strong>Caller Phone:</strong> {message['Caller_Phone'] || 'N/A'}</p>
          <p><strong>Reason:</strong> {message['Message_Reason'] || 'N/A'}</p>
          {!showReadMessages && (
            <button
              onClick={() => markMessageAsRead(message.id)}
              style={{ marginTop: '0.5rem', backgroundColor: '#d6336c', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px' }}
            >
              Mark As Read
            </button>
          )}
        </div>
      ))}

      {/* Orders */}
      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {displayedOrders.map(order => (
          <div key={order.id} style={{ backgroundColor: '#e6f9e6', border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', fontSize: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Order #{order['Order ID']}</h2>
              <button
                onClick={() => printEntry(order)}
                style={{ backgroundColor: '#0d6efd', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px' }}
              >
                PRINT
              </button>
            </div>

            <p><strong>Customer:</strong> {order['Customer Name']}</p>
            <p><strong>Phone:</strong> {order['Customer Contact Number'] || 'N/A'}</p>
            <p><strong>Order Type:</strong> {order['Order Type'] || 'N/A'}</p>

            {/* Delivery details (unchanged) */}
            {order['Order Type']?.toLowerCase() === 'delivery' && (
              <>
                <p><strong>Delivery Address:</strong> {order['Delivery Address']}</p>
                <p><strong>Order Instructions:</strong> {order['Order Instructions'] || 'N/A'}</p>
                <p><strong>Status:</strong> {order.status || 'N/A'}</p>
                <p><strong>Paid At:</strong> {order.PaidAt || 'N/A'}</p>
                <p><strong>Payment ID:</strong> {order.paymentIntentId || 'N/A'}</p>
                <p><strong>Checkout Session ID:</strong> {order.checkoutSessionId || 'N/A'}</p>
              </>
            )}

            {/* ✅ Status message with color badge for PICK UP orders */}
            {order['Order Type'] === 'PICK UP' && (() => {
              const status = (order.status || '').toUpperCase().trim();
              let statusMessage = '';
              let statusColor = 'black';
              let badge = '⚪';

              if (!status || status === 'N/A' || status === 'NOT PAID') {
                statusMessage = 'Order Not Paid';
                statusColor = '#f0ad4e';
                badge = '🟡';
              } else if (status === 'PENDING') {
                statusMessage = 'Customer Completing Payment - Stand By';
                statusColor = '#ffc107';
                badge = '🟠';
              } else if (status === 'PAID') {
                statusMessage = 'Customer Has Completed Payment - Proceed with Order';
                statusColor = '#28a745';
                badge = '🟢';
              } else if (status === 'CANCELED' || status === 'FAILED') {
                statusMessage = 'Payment Failed - Contact the Customer to Confirm Order';
                statusColor = '#dc3545';
                badge = '🔴';
              }

              return (
                <p style={{ color: statusColor, fontWeight: 'bold', marginTop: '0.5rem' }}>
                  <strong>Status:</strong> {badge} {statusMessage}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{entry['Order Type'] === 'MESSAGE' ? '📨 Message' : `Order #${entry['Order ID'] || entry.id}`}</h3>
                  <button
                    onClick={() => printEntry(entry)}
                    style={{ backgroundColor: '#0d6efd', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px' }}
                  >
                    PRINT
                  </button>
                </div>

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
                        <p><strong>Status:</strong> {entry.status || 'N/A'}</p>
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
