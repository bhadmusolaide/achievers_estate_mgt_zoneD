const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const fallbackData = () => ({
  account_balance: 0,
  total_outstanding: 0,
  total_project_budget: 0,
  total_debt: 0,
  projects: [],
  recent_payments: [],
  pledges: [],
  top_debtors: [],
});

export const publicDashboardService = {
  async getPublicData() {
    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase credentials not configured');
        return fallbackData();
      }

      const baseUrl = supabaseUrl.replace(/\/$/, '');
      const response = await fetch(
        `${baseUrl}/functions/v1/public-dashboard`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Public dashboard fetch error:', response.status, errorText);
        return fallbackData();
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching public dashboard data:', error);
      return fallbackData();
    }
  },

  async lookupLandlord(phoneNumber) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Configuration not available');
    }

    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const response = await fetch(
      `${baseUrl}/functions/v1/public-landlord-lookup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          phone: phoneNumber,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Lookup failed');
    }

    return data;
  },
};

export default publicDashboardService;
