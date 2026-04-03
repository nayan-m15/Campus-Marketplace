import { useEffect } from "react";
import { supabase } from "./data/supabaseClient";

function SupabaseTest() {
  useEffect(() => {
    async function test() {
      console.log("🔥 Testing Supabase...");

      const { data, error } = await supabase
        .from("users")
        .select("*");

      console.log("DATA:", data);
      console.log("ERROR:", error);

      // 🔥 TEST INSERT (temporary)
      const insertResult = await supabase.from("users").insert([
        {
          name: "Test User",
          email: "test@test.com",
          password: "1234"
        }
      ]);

      console.log("INSERT RESULT:", insertResult);
    }

    test();
  }, []);

  return (
    <div>
      <h2>Testing Supabase Connection...</h2>
    </div>
  );
}

export default SupabaseTest;