const API_URL = 'http://localhost:5000';

const JH_DISTRICTS = [
  "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "Garhwa", "Giridih",
  "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar",
  "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj",
  "Seraikela-Kharsawan", "Simdega", "West Singhbhum", "East Singhbhum"
];

async function seed() {
  try {
    let events = [];
    try {
      const response = await fetch(`${API_URL}/api/matches/events`);
      if (!response.ok) throw new Error('Failed to fetch events');
      events = await response.json();
    } catch (e) {
      console.log('Error fetching events. Is server running?', e.message);
      return;
    }

    let event = events.find(e => e.isActive) || events[0];
    if (!event) {
      console.log('No events exist in the database! Please create an event first.');
      return;
    }

    console.log(`Using existing event ID: ${event.id}`);

    // Create 24 teams
    for (const district of JH_DISTRICTS) {
      console.log(`Creating team for ${district}...`);
      try {
        const response = await fetch(`${API_URL}/api/matches/teams`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${district} Team`,
            state: "Jharkhand",
            district: district,
            coach: "TBD",
            eventId: event.id
          })
        });
        if (response.ok) {
          console.log(`Created team for ${district}`);
        } else {
          console.log(`Error creating team ${district}:`, await response.text());
        }
      } catch (err) {
        console.log(`Error creating team ${district}:`, err.message);
      }
    }
    
    console.log("Seeding complete.");
  } catch (err) {
    console.error(err);
  }
}

seed();
