const SECRET = () => process.env.GA4_API_SECRET;
const MID = () => process.env.GA4_MEASUREMENT_ID || 'G-PFSGPCRDMZ';

export const ga4Ready = () => Boolean(SECRET() && MID());

export async function ga4Purchase(lead) {
  if (!ga4Ready()) return { sent: false, reason: 'не налаштовано' };
  if (!lead || !(Number(lead.total) > 0)) return { sent: false, reason: 'немає суми' };

  const cid = (lead.ga_cid && String(lead.ga_cid)) || ('srv.' + lead.id);

  const body = {
    client_id: cid,
    non_personalized_ads: false,
    events: [{
      name: 'purchase',
      params: {
        transaction_id: String(lead.id),
        value: Math.round(Number(lead.total) || 0),
        currency: 'UAH'
      }
    }]
  };

  try {
    const r = await fetch(
      'https://www.google-analytics.com/mp/collect?measurement_id=' +
        encodeURIComponent(MID()) + '&api_secret=' + encodeURIComponent(SECRET()),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    return { sent: r.ok, reason: r.ok ? null : 'ga ' + r.status };
  } catch (e) {
    return { sent: false, reason: String(e.message || e) };
  }
}
