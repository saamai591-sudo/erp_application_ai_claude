import { useLocation, useParams } from "react-router-dom";
import { GoodsItemForm, GoodsItemList } from "../components/GoodsItemShared";

export default function Services() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <GoodsItemForm kind="SERVICE" />;
  if (isEdit) return <GoodsItemForm kind="SERVICE" editId={Number(id)} />;
  return <GoodsItemList kind="SERVICE" />;
}
