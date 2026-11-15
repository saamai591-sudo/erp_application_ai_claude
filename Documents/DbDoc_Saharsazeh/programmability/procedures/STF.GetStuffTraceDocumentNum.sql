create   proc [STF].[GetStuffTraceDocumentNum]
	(
	@stuffTraceId int,
	@TraceId int
	)

	as

	select *
	into #StuffTraceDocumentNum
	from stf.StuffTraceDocumentNum
	where StuffTraceID = @stuffTraceId

	select 
            case when b.StuffTraceDocumentNumID is not null then b.StuffTraceDocumentNumID else 0 end  StuffTraceDocumentNumID,
            case when b.StuffTraceDocumentNumID is not null then b.StuffTraceID else 0 end StuffTraceID ,
            a.TraceID ,
            a.TraceDocumentNumTypeID ,
            c.Name DocumentNumTypeName ,
            cast (case when b.StuffTraceDocumentNumID is not null then b.IsMandetory 
				 when @stuffTraceId <= 0 then 1
				 else 0 end as bit) IsMandetory,
            cast (case when b.StuffTraceDocumentNumID is not null then 1 else 0 end as bit) IsSelected ,
			cast (case when d.CheckInventory = 1 
					  and c.EngName in ( 'StockReceipt', 'ReturnStockReceipt', 'Outgoing', 'ReturnedOutgoing', 'RecountingInventory')
				 then 1 else 0 end as bit) MustBeSelected ,
			case when b.StuffTraceDocumentNumID is not null then b.Version else 0 end Version,
			case when b.StuffTraceDocumentNumID is not null then b.Creator else 0 end Creator,
			case when b.StuffTraceDocumentNumID is not null then b.CreationDate else GETDATE() end CreationDate
	from stf.TraceDocumentNumType a
	left join #StuffTraceDocumentNum b
		on a.TraceDocumentNumTypeID = b.TraceDocumentNumTypeID
	join cfg.DocumentNumType c on c.DocumentNumTypeID = a.DocumentNumTypeID
	join stf.Trace d on d.TraceID = a.TraceID
	where a.TraceID = @TraceId