import { useEffect, useRef } from "react";

export function TriStateCheckbox({
  state,
  onChange,
}: {
  state: "all" | "none" | "some";
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);

  return <input ref={ref} type="checkbox" checked={state === "all"} onChange={onChange} />;
}
