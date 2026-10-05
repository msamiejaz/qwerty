const { createClient } = require('@supabase/supabase-js');

const GROUPS = ['Friends', 'Family', 'Work', 'Other'];

// Created once per warm function instance and reused between requests
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? '' : JSON.stringify(body)
});

function clean(raw) {
  let b = {};
  try { b = JSON.parse(raw || '{}'); } catch { return null; }
  const s = (v, max) => String(v ?? '').trim().slice(0, max);
  const c = {
    name: s(b.name, 100), email: s(b.email, 120), phone: s(b.phone, 40),
    grp: GROUPS.includes(b.grp) ? b.grp : 'Other', notes: s(b.notes, 500),
    updated: new Date().toISOString()
  };
  return c.name ? c : null;
}

exports.handler = async (event) => {
  try {
    const last = event.path.split('/').pop();
    const id = /^\d+$/.test(last) ? Number(last) : null;

    // ----- List: search + filter + pagination done in the database -----
    if (event.httpMethod === 'GET') {
      const p = event.queryStringParameters || {};
      const limit = Math.min(Math.max(parseInt(p.limit) || 10, 1), 50);
      const page = Math.max(parseInt(p.page) || 1, 1);
      const from = (page - 1) * limit;

      let q = supabase.from('contacts').select('*', { count: 'exact' });
      const term = String(p.q || '').replace(/[,()%*_\\"]/g, ' ').trim();
      if (term) q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
      if (GROUPS.includes(p.grp)) q = q.eq('grp', p.grp);

      const { data, count, error } = await q.order('name').range(from, from + limit - 1);
      if (error) {
        if (error.code === 'PGRST103') return json(200, { rows: [], total: count || 0 }); // page past the end
        throw error;
      }
      return json(200, { rows: data, total: count });
    }

    // ----- Create -----
    if (event.httpMethod === 'POST') {
      const c = clean(event.body);
      if (!c) return json(400, { error: 'Name is required.' });
      const { data, error } = await supabase.from('contacts').insert(c).select().single();
      if (error) throw error;
      return json(201, data);
    }

    // ----- Update -----
    if (event.httpMethod === 'PUT' && id) {
      const c = clean(event.body);
      if (!c) return json(400, { error: 'Name is required.' });
      const { data, error } = await supabase.from('contacts').update(c).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return data ? json(200, data) : json(404, { error: 'Contact not found.' });
    }

    // ----- Delete -----
    if (event.httpMethod === 'DELETE' && id) {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      return { statusCode: 204, body: '' };
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Server error.' });
  }
};
