------------------------------ START #8277
CREATE   PROCEDURE STC.InventoryAnalysis
(
	@FinicialPeriodID INT,
	@StuffIds NVARCHAR(250)=''
)
--WITH ENCRYPTION
AS
	DECLARE @Culture                         VARCHAR(10),
	        @user                            INT,
	        @CultureNo                       TINYINT    
	
	SET @Culture = CFG.GetuserCulture();
	SET @user = CFG.GetuserID();
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	declare @filterStuffId bit=0;
	select @filterStuffId = case when isnull(@stuffIds,'')<>'' then 1 else 0 end

	select StuffId=try_cast(value as int)  into  #StuffIds from cfg.Split(@StuffIds,',')
	delete from #StuffIds where StuffId is null


	-- #vwCardexAnalysis
	SELECT StuffID,
	       SUM(mainquantity)     MainQuantity,
	       SUM(SubQuantity)      SubQuantity
	INTO   #vwCardexAnalysis
	FROM   stc.VwCardex vc
	       INNER JOIN cfg.vwStockAccess AS vsa
	            ON  vsa.StockID = vc.StockID
	WHERE  FinancialPeriodID = @FinicialPeriodID
			and (@filterStuffId=0 or exists(select * from #StuffIds s where s.StuffId=vc.StuffID))
	GROUP BY
	       StuffID
	
	-- #StuffOnWay
	SELECT mi.StuffID,
	       SUM(case when hdr.PurchaseRequestState <> 4 then mi.AcceptRequestMainMeasureQuantity else r.DoMainQuantity end) - ISNULL(SUM(vw.MainQuantity), 0) InventoryOnTheWay
	INTO   #StuffOnWay
	FROM   REQ.PurchaseRequestItem AS mi
	INNER JOIN REQ.PurchaseRequest hdr
	    ON  hdr.PurchaseRequestID = mi.PurchaseRequestID
	INNER JOIN [REQ].[PurchaseRequest_Remains] r
		ON r.PurchaseRequestItemID = mi.PurchaseRequestItemID
	LEFT JOIN  
	(
	select vw1.PurchaseRequestItemID,sum(vw1.StockReceiptMainQuantity) MainQuantity
	from REQ.PurchaseRequest_StockReceipt vw1
	group by vw1.PurchaseRequestItemID
	) vw
	    ON  vw.PurchaseRequestItemID = mi.PurchaseRequestItemID
	WHERE  hdr.PurchaseRequestState = 2
		and hdr.PurchaseRequestState  <> 3
		and (@filterStuffId=0 or exists(select * from #StuffIds s where s.StuffId=mi.StuffID))
	GROUP BY
	       mi.StuffID

	-- #StuffRequest_Remains
	SELECT StuffID,SUM(srr.NonOutgoing) NonOutgoing into #StuffRequest_Remains
	FROM req.StuffRequest_Remains AS srr
	WHERE srr.StuffRequestState = 2
		and (@filterStuffId=0 or exists(select * from #StuffIds s where s.StuffId=srr.StuffID))
	GROUP BY srr.StuffID
	Having SUM(srr.NonOutgoing) > 0

	select * into #vwEnum
	from cfg.VwEnums
	where Enum = 'MinControlTypes'

	SELECT s.StuffID,
	       s.Code                           StuffCode,
	       CASE 
	            WHEN @CultureNo = 1 THEN s.Title
	            ELSE s.Title2
	       END                              StuffTitle,
	       s.StuffGroupCode,
	       s.StuffGroupTitle                GroupTitle,
	       s.StuffDetailType,
	       s.MainMeasureUnit,
	       ISNULL(vc.MainQuantity, 0)       MainQuantity,
	       ISNULL(MinValue, 0)              MinValue,
	       ve.value                            ControlType,
	       ISNULL(orderpoint, 0)            orderpoint,
	       ISNULL(MaxValue, 0)              MaxValue,
	       CASE 
	            WHEN vc.MainQuantity <= 0 THEN 1
	            WHEN 0 < vc.MainQuantity AND vc.MainQuantity <= ISNULL(minvalue, 0) THEN 2
	            WHEN ISNULL(MinValue, 0) < vc.MainQuantity AND vc.MainQuantity <= ISNULL(orderpoint, 0) THEN 3
	            WHEN ISNULL(orderpoint, 0) < vc.MainQuantity AND vc.MainQuantity <= ISNULL(MaxValue, 0) THEN 4
	            WHEN vc.MainQuantity > ISNULL(MaxValue, 0) THEN 5
	       END                              InventoryStatusCode,
	       ISNULL(InventoryOnTheWay, 0)     InventoryOnTheWay,
	       ISNULL(srr.NonOutgoing,0)        AcceptedStuffRequest,
	       ISNULL(vc.MainQuantity, 0) + ISNULL(InventoryOnTheWay, 0) - ISNULL(srr.NonOutgoing,0) as AvailableQuantity
	FROM   stf.VWStuff s
	join stf.StuffDetail sd on s.StuffID = sd.StuffID
	left join #vwEnum ve on sd.ControlType = ve.KeyValue
	       left JOIN #vwCardexAnalysis vc
	            ON  s.StuffID = vc.stuffid
	       LEFT JOIN #StuffOnWay T
	            ON  T.StuffID = s.StuffID
	       Left join #StuffRequest_Remains AS srr on s.StuffID = srr.StuffID   
		   where vc.StuffID is not null
		   or t.StuffID is not null
		   or srr.StuffID is not null
