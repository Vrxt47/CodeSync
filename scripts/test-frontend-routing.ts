async function testRouting() {
  console.log("=================================================");
  console.log("🌐 TESTING FRONTEND ROUTES & MOCK DATA REMOVAL");
  console.log("=================================================");

  const routes = [
    { path: "/", name: "Root Route" },
    { path: "/login", name: "Login Route" },
    { path: "/register", name: "Register Route" },
    { path: "/dashboard", name: "Dashboard Route" },
    { path: "/workspace/e18de66e-5fb9-4029-81d2-c1f880642c7a", name: "Workspace Route" },
  ];

  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route.path}`, {
        redirect: "manual",
      });
      const text = await res.text();
      console.log(`\nRoute: ${route.name} (${route.path})`);
      console.log(`  Status: ${res.status}`);
      console.log(`  Has MY-WORKSPACE: ${text.includes("MY-WORKSPACE")}`);
      console.log(`  Has main.cpp: ${text.includes("main.cpp")}`);
      console.log(`  Has Header.tsx: ${text.includes("Header.tsx")}`);
      console.log(`  Has helper.ts: ${text.includes("helper.ts")}`);
      console.log(`  Has g++ demo: ${text.includes("g++ -std=c++17")}`);
      console.log(`  Has Initializing CodeSync: ${text.includes("Initializing CodeSync")}`);
      console.log(
        `  Has Sign In / Login text: ${text.includes("Sign In") || text.includes("Welcome back") || text.includes("login")}`
      );
    } catch (err: any) {
      console.log(`Route ${route.path} error:`, err.message);
    }
  }
}

testRouting();
