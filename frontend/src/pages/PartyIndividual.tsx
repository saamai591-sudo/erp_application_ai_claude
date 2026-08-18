import { useLocation, useParams } from "react-router-dom";
import { PartyList, PartyForm } from "../components/PartyShared";

export default function PartyIndividual() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PartyForm category="INDIVIDUAL" title="شخص حقیقی جدید" backPath="/parties/individual" />;
  if (isEdit) return <PartyForm category="INDIVIDUAL" title="ویرایش شخص حقیقی" backPath="/parties/individual" editId={Number(id)} />;
  return <PartyList category="INDIVIDUAL" title="شخص حقیقی" description="اشخاص حقیقی — کد به‌صورت خودکار بر اساس «نوع تفصیل» صادر می‌شود" />;
}
