import { useLocation, useParams } from "react-router-dom";
import { PartyList, PartyForm } from "../components/PartyShared";

export default function PartyLegal() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PartyForm category="LEGAL" title="شخص حقوقی / موسسه جدید" backPath="/parties/legal" />;
  if (isEdit) return <PartyForm category="LEGAL" title="ویرایش شخص حقوقی / موسسه" backPath="/parties/legal" editId={Number(id)} />;
  return <PartyList category="LEGAL" title="شخص حقوقی / موسسه" description="اشخاص حقوقی، مشارکت خاص و بانک/موسسه مالی" />;
}
