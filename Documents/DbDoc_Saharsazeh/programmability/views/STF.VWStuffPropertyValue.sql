create   view STf.VWStuffPropertyValue
as

select a.StuffID,
STRING_AGG(case when a.traceitemid is null then a.value
									else b.item end,', ') 
			WITHIN GROUP (ORDER BY d.RowIndex) StandardTitle,
STRING_AGG(case when a.traceitemid is null then a.value2
									else b.item2 end,', ') 
			WITHIN GROUP (ORDER BY d.RowIndex) StandardTitle2
FROM STF.StuffPropertyValue a
left join STF.TraceItem b
on a.traceitemid = b.traceitemid
join STF.Stuff c
	on a.StuffID = c.StuffID
join stf.StuffGroupProperty d
	on d.StuffGroupID = c.StuffGroupID
	and d.PropertyID = a.PropertyID
group by a.StuffID
