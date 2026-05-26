import { Card, CardContent } from "@/components/ui/card";
import AdminRegistrationGuidelines from "../../AdminRegistrationGuidelines.jsx";
import { apiFetch } from "../utils/adminApi";

export default function RegistrationTab({ toast }) {
  return (
    <Card>
      <CardContent className="p-4">
        <AdminRegistrationGuidelines apiFetch={apiFetch} toast={toast} />
      </CardContent>
    </Card>
  );
}
