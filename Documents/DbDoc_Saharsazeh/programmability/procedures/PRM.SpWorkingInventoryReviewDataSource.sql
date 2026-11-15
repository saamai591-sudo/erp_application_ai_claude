-------------------------------------------------------------------------------------------------------------------------
Create   proc [PRM].SpWorkingInventoryReviewDataSource
--WITH ENCRYPTION
	as
	
    DECLARE @Columns NVARCHAR(MAX),
            @query NVARCHAR(MAX),
            @param NVARCHAR(MAX),
            @ColumnsInCreateTable NVARCHAR(MAX),
			@UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10)

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';


    SELECT @Columns = STUFF(
								(
									SELECT DISTINCT
										   ',' + QUOTENAME(TraceID)
									FROM STF.Trace
									where CheckInventory = 1
									FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,''
						   );

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';


		set @query = N'
		select ''Outgoing'' DocName,Number,o.Date,cc.CostCenterID,StuffID,MainQuantity,SubQuantity,' + @Columns + '
		from stc.OutgoingItem oi
		join stc.Outgoing o
			on o.OutgoingID = oi.OutgoingID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt
			on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		left join 
		(select OutgoingItemID,a.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
					 else Value end value
		from stc.OutgoingItemTrace a
		join stf.trace b on a.traceid = b.traceid
		)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + ')		
		) oit
			on oit.OutgoingItemID = oi.OutgoingItemID
		join cfg.CostCenter cc
			on cc.DlID = o.DeliverDlID
		where sdt.DocumentType = 2
		
		union all

		select ''ConsumptionStatistic'' DocName,Number,cs.Date,cs.CostCenterID,csi.StuffID,-1 * MainQuantity MainQuantity,-1 * SubQuantity SubQuantity,' + @Columns + '
		from prm.ConsumptionStatisticItem csi
		join prm.ConsumptionStatistic cs
			on cs.ConsumptionStatisticID = csi.ConsumptionStatisticID
		left join 
		(select ConsumptionStatisticItemID,a.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
					 else Value end value		
		from prm.ConsumptionStatisticItemTrace a
		join stf.trace b on a.traceid = b.traceid
		)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + ')		
		) csit
			on csi.ConsumptionStatisticItemID = csit.ConsumptionStatisticItemID

		
		union all

		select  ''ProductionStatistic'' DocName,Number,ps.Date,ps.CostCenterID,StuffID,MainQuantity,SubQuantity,' + @Columns + '
		from prm.ProductionStatisticItem psi
		join prm.ProductionStatistic ps
			on ps.ProductionStatisticID = psi.ProductionStatisticID
		left join
		(select ProductionStatisticItemID,a.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
					 else Value end value			
		from prm.ProductionStatisticItemTrace a
		join stf.trace b on a.traceid = b.traceid
		)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + ')		
		)		psit
			on psi.ProductionStatisticItemID = psit.ProductionStatisticItemID

		
		union all

		select  ''ProductionDelivery'' DocName,Number,pd.Date,pd.DeliverCostCenterId CostCenterID,pdi.StuffID,MainQuantity ,SubQuantity ,' + @Columns + '
		from prm.ProductionDeliveryItem pdi
		join prm.ProductionDelivery pd
			on pd.ProductionDeliveryID = pdi.ProductionDeliveryID
		left join 
		(select ProductionDeliveryItemID,a.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
					 else Value end value			
		from prm.ProductionDeliveryItemTrace a
		join stf.trace b on a.traceid = b.traceid
		)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + ')		
		)		pdit
			on pdit.ProductionDeliveryItemID = pdi.ProductionDeliveryItemID

		union all

		select  ''ProductionDelivery'' DocName,Number,pd.Date,pd.CostCenterID,pdi.StuffID,-1 * MainQuantity MainQuantity,-1 * SubQuantity SubQuantity,' + @Columns + '
		from prm.ProductionDeliveryItem pdi
		join prm.ProductionDelivery pd
			on pd.ProductionDeliveryID = pdi.ProductionDeliveryID
		left join 
		(select ProductionDeliveryItemID,a.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
					 else Value end value			
		from prm.ProductionDeliveryItemTrace a
		join stf.trace b on a.traceid = b.traceid
		)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + ')		
		)		pdit
			on pdit.ProductionDeliveryItemID = pdi.ProductionDeliveryItemID

		
		union all

		select ''WorkingInventory'' DocName,Number,wi.Date,wi.CostCenterID,StuffID,MainQuantity,SubQuantity,' + @Columns + '
		from prm.WorkingInventoryItem wii
		join prm.WorkingInventory wi
			on wi.WorkingInventoryID = wii.WorkingInventoryID
		left join 
		(select WorkingInventoryItemID,a.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
					 else Value end value			
		from prm.WorkingInventoryItemTrace a
		join stf.trace b on a.traceid = b.traceid
		)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + ')		
		)		wiit
			on wiit.WorkingInventoryItemID = wiit.WorkingInventoryItemID

		
		union all

		select ''StockReceipt'' DocName,Number,sr.Date,cc.CostCenterID,sri.StuffID,-1 * MainQuantity MainQuantity,-1 * SubQuantity SubQuantity,' + @Columns + '
		from stc.StockReceiptItem sri
		join stc.StockReceipt sr
			on sr.StockReceiptID = sri.StockReceiptID		
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
            ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt
			on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		left join 
		(select StockReceiptItemID,a.TraceID,
				case when AccountLevelTypeID = 1 then  cast (DLID as nvarchar(max))
  					 when AccountLevelTypeID = 6 then  cast (TraceItemID as nvarchar(max))
					 when AccountLevelTypeID = 5 then  CFG.GetCLRSaturnDate(value,''' + @DateFormat + N'''  , 0,''' + @DateType+ N''')
					 else Value end value			
		from stc.StockReceiptItemTrace a
		join stf.trace b on a.traceid = b.traceid
		)x
		pivot
		(
			max(value)
			for traceid in (' + @Columns + ')		
		)		srit
			on srit.StockReceiptItemID = sri.StockReceiptItemID
		join cfg.CostCenter cc
			on cc.DlID = sr.DeliverDlID
		where sdt.DocumentType = 0
		'
		--print @query
		exec(@query)
;	
