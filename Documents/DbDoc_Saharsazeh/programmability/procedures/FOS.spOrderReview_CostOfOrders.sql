
------------------------------------------------------------------
CREATE   PROC FOS.spOrderReview_CostOfOrders
(
	@FromDate date,
	@EndDate date,
	@ProformaInvoiceIDs varchar(max) = null
)
--WITH ENCRYPTION 
as
	create Table #CostOfOrder
	(
		CostOfOrderID int
	)

	insert into	#CostOfOrder	
	select 
	CostOfOrderID
	from fos.CostOfOrder
	where ProformaInvoiceID in (   SELECT value
                                FROM   CFG.R_FnCommaStr2Table(@ProformaInvoiceIDs) )
	group by CostOfOrderID

	insert into #CostOfOrder
	select 
	CostOfOrderID
	from fos.CostOfOrder co
	join fos.Registration r
		on co.RegistrationID = r.RegistrationID
	where r.ProformaInvoiceID in (   SELECT value
                                FROM   CFG.R_FnCommaStr2Table(@ProformaInvoiceIDs) )
	group by CostOfOrderID

	insert into #CostOfOrder
	select 
	CostOfOrderID
	from fos.CostOfOrder co
	join fos.BillOfLading bl
		on co.BillOfLadingID = bl.BranchID
	join fos.BillOfLadingItem bli
		on bl.BillOfLadingID = bli.BillOfLadingID
	join vnd.PurchaseInvoiceItem pii
		on pii.PurchaseInvoiceItemID = bli.PurchaseInvoiceItemID
	join fos.ProformaInvoiceItem pii2
		on pii2.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
	where pii2.ProformaInvoiceID in (   SELECT value
                                FROM   CFG.R_FnCommaStr2Table(@ProformaInvoiceIDs) )
	group by CostOfOrderID

	insert into #CostOfOrder
	select 
	CostOfOrderID
	from fos.CostOfOrder co
	join fos.ClearanceItem c
		on co.ClearanceID = c.ClearanceID
	join fos.BillOfLadingItem bli
		on bli.BillOfLadingItemID = c.BillOfLadingItemID
	join vnd.PurchaseInvoiceItem pii
		on pii.PurchaseInvoiceItemID = bli.PurchaseInvoiceItemID
	join fos.ProformaInvoiceItem pii2
		on pii2.ProformaInvoiceItemID = pii.ProformaInvoiceItemID
	where pii2.ProformaInvoiceID in (   SELECT value
                                FROM   CFG.R_FnCommaStr2Table(@ProformaInvoiceIDs) )
	group by CostOfOrderID

	DECLARE @UserID INT,
	        @DateType TINYINT,
	        @DateFormat VARCHAR(10),
	        @Culture VARCHAR(10),
			@ProformaInvoice nvarchar(1024),
			@Registration nvarchar(1024),
			@BillOfLading nvarchar(1024),
			@Clearance nvarchar(1024),
			@Count int,
			@CultureNo tinyint
	
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 

    SELECT  @ProformaInvoice =  lev.[Value] 
    FROM    CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE   le.Enum = 'CostOfOrderBases'
            AND le.Item = 'Proforma'
            AND lev.Culture = @Culture

    SELECT  @Registration =  lev.[Value] 
    FROM    CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE   le.Enum = 'CostOfOrderBases'
            AND le.Item = 'Registration'
            AND lev.Culture = @Culture

    SELECT  @BillOfLading =  lev.[Value] 
    FROM    CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE   le.Enum = 'CostOfOrderBases'
            AND le.Item = 'BillOfLading'
            AND lev.Culture = @Culture

    SELECT  @Clearance =  lev.[Value] 
    FROM    CFG.LocalizeEnum le
            JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE   le.Enum = 'CostOfOrderBases'
            AND le.Item = 'Clearance'
            AND lev.Culture = @Culture

	select @Count = count(*)
	from #CostOfOrder

		select 
			co.CostOfOrderID,
			case co.BaseType when 1 then @ProformaInvoice
							 when 2 then @Registration
							 when 3 then @BillOfLading
							 when 4 then @Clearance
							 end BaseType,
			case co.BaseType when 1 then pi.Number
							 when 2 then r.RegistrationNumber
							 when 3 then bl.BillNumber
							 when 4 then c.CotajNumber
							 end BaseNumber,
			case co.BaseType when 1 then pi.Date
							 when 2 then r.RegistrationDate
							 when 3 then bl.IssueDate
							 when 4 then c.CotajDate
							 end  BaseDate,
			CFG.GetCLRSaturnDate(
							case co.BaseType when 1 then pi.Date
											 when 2 then r.RegistrationDate
											 when 3 then bl.IssueDate
											 when 4 then c.CotajDate
											 end,
							  @DateFormat, 0, @DateType) Date_BaseDate,
			case when @CultureNo = 1 then sc.Title
	             when @CultureNo = 2 then sc.Title2
	        end as Cost,
			dl.Code DlCode,			
			case when @CultureNo = 1 then dl.Title
	             when @CultureNo = 2 then dl.Title2
	        end as DlTitle,
			pi2.InvoiceNumber,
			pi2.InvoiceDate,
			CFG.GetCLRSaturnDate(pi2.InvoiceDate, @DateFormat, 0, @DateType) Date_InvoiceDate,
			coi.Amount 
		from fos.CostOfOrder co
		join fos.CostOfOrderItem coi
			on co.CostOfOrderID = coi.CostOfOrderID
		JOIN FOS.SpecialCost SC
			ON SC.SpecialCostID = COI.SpecialCostID
		left join fos.ProformaInvoice pi
			on pi.ProformaInvoiceID = co.ProformaInvoiceID
		left join fos.Registration r
			on r.RegistrationID = co.RegistrationID
		left join fos.BillOfLading bl
			on bl.BillOfLadingID = co.BillOfLadingID
		left join fos.Clearance c
			on c.ClearanceID = co.ClearanceID
		left join cfg.Party	
			on Party.PartyID = coi.PartyID
		left join acc.dl		
			on dl.DLID = Party.DlID
		left join vnd.PurchaseInvoiceItem pii
			on pii.PurchaseInvoiceItemID = coi.PurchaseInvoiceItemID
		left join vnd.PurchaseInvoice pi2
			on pi2.PurchaseInvoiceID = pii.PurchaseInvoiceID
		left join #CostOfOrder temp
			on temp.CostOfOrderID = co.CostOfOrderID
		where co.Date between @FromDate and @EndDate 
		AND ( @ProformaInvoiceIDs IS NULL OR  temp.CostOfOrderID IS NOT NULL);
