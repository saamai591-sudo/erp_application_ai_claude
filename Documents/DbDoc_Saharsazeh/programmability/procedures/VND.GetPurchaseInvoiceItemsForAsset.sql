
CREATE   PROCEDURE [VND].GetPurchaseInvoiceItemsForAsset
(
	@Type tinyint,
	@PartyId bigint = null,
	@BranchId int = null,
	@Date date = null
)
--WITH ENCRYPTION
AS
BEGIN

	DECLARE @UserID INT,
	@DateType TINYINT,
	@DateFormat VARCHAR(10),
	@CultureInfo VARCHAR(10),
	@CultureNo TINYINT

	SET @UserID = CFG.GetuserID()
	SET @CultureInfo = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @CultureInfo
	
        SELECT  @DateType = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Type'
                AND us.UserID = @UserID

	IF @DateType IS NULL
	SET @DateType = CASE CFG.GetuserCulture()
	WHEN 'fa' THEN 0
	WHEN 'en' THEN 1
	WHEN 'ar' THEN 2
	END

	SELECT  @DateFormat = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Format'
                AND us.UserID = @UserID

	IF @DateFormat IS NULL
	SET @DateFormat = 'YY/MM/DD'


	select *
		into #vwStuff
	from STF.vwStuff
	where IsActive = 1
		and
		(
		(@Type = 1 and type = 0 and (StuffDetailType = 4 or FixedAssetConversion = 1))
		or
		(@Type = 2 and ((type = 1 and StockReceiptCostAgent = 1) or (type = 0 and (StuffDetailType in (2,4,5,7,8) or FixedAssetConversion = 1))))
		or
		(@Type = 3 and type = 1)
		)

	--creation
	if (@Type = 1)
	begin
		select p.PurchaseInvoiceItemID,
			i.Number,
			CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
			i.InvoiceNumber,
			CFG.GetCLRSaturnDate(i.[InvoiceDate], @DateFormat, 0, @DateType) InvoiceDateString,
			dl.Code DlCode,
			case when @CultureNo = 1 then dl.Title else dl.Title2 end DlTitle,
			p.StuffID,
			s.Code StuffCode,
			case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
			p.MainQuantity,
			p.SubQuantity,
			r.Non RemainMainQuantity,
			r.NonSub RemainSubQuantity,
			pr.Non NonReceiptCostInBaseCurrency,
			pr.Price
		from VND.PurchaseInvoiceItem p
			join VND.PurchaseInvoice i on p.PurchaseInvoiceID = i.PurchaseInvoiceID
			join #vwStuff s on p.StuffID = s.StuffID
			join VND.PurchaseInvoice_PriceRemains pr on p.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
			join VND.PurchaseInvoice_Remains r on p.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
			join acc.dl on dl.DLID = i.DlID
		where pr.Non > 0
			and r.Non > 0
			and i.BranchID =@BranchId
			and i.Date <= @Date
			and i.Status = 2
	end

	--for repair cost and amount utilization cost
	if (@Type = 2)
	begin
		declare @AssetControlSl int

		select @AssetControlSl = ConfigValue
		from cfg.Configuration
		where ConfigKey = 'AssetControlSl'

		select p.PurchaseInvoiceItemID,
			i.Number,
			CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
			i.InvoiceNumber,
			CFG.GetCLRSaturnDate(i.[InvoiceDate], @DateFormat, 0, @DateType) InvoiceDateString,
			dl.Code DlCode,
			case when @CultureNo = 1 then dl.Title else dl.Title2 end DlTitle,
			p.StuffID,
			s.Code StuffCode,
			case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
			p.MainQuantity,
			p.SubQuantity,
			p.Fee,
			r.Non,
			r.NonSub,
			pr.Non NonReceiptCostInBaseCurrency,
		case when s.[Type] = 1 then sd.SlID else @AssetControlSl end SlID
		from VND.PurchaseInvoiceItem p
			join VND.PurchaseInvoice i on p.PurchaseInvoiceID = i.PurchaseInvoiceID
			join #vwStuff s on p.StuffID = s.StuffID
			join STF.StuffDetail sd on p.StuffID = sd.StuffID
			join VND.PurchaseInvoice_PriceRemains pr on p.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
			join VND.PurchaseInvoice_Remains r on p.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
			join acc.dl on dl.DLID = i.DlID
		where pr.Non > 0
				and i.Status = 2
				and i.BaseType <> 18
				and p.AssetReceiptItemID IS NULL
				and (@BranchId is null or i.BranchID = @BranchId)
				and (@Date is null or i.Date <= @Date)
	end

	-- insurance
	if (@Type = 3)
	begin
		declare @DlId bigint = null
		select @DlId = DlID from CFG.Party where PartyID = @PartyId

		select p.PurchaseInvoiceItemID,
			i.Number,
			CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
			i.InvoiceNumber,
			CFG.GetCLRSaturnDate(i.[InvoiceDate], @DateFormat, 0, @DateType) InvoiceDateString,
			dl.Code DlCode,
			case when @CultureNo = 1 then dl.Title else dl.Title2 end DlTitle,
			s.Code StuffCode,
			case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
			p.CostOfBuying,
			pr.Non NonReceiptCostInBaseCurrency
		from VND.PurchaseInvoiceItem p
			join VND.PurchaseInvoice i on p.PurchaseInvoiceID = i.PurchaseInvoiceID
			join #vwStuff s on p.StuffID = s.StuffID
			join VND.PurchaseInvoice_PriceRemains pr on p.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
			join acc.dl on dl.DLID = i.DlID
			where (@DlId is null or i.DlID = @DlId) 
			and i.BranchID = @BranchId 
			and pr.Non > 0 
			and pr.NonPricedQuantity > 0
			and i.[Date] <= @Date
			and i.Status = 2
	end

	if (@Type = 4)
	begin
		select p.PurchaseInvoiceItemID,
			i.Number,
			CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
			i.InvoiceNumber,
			CFG.GetCLRSaturnDate(i.InvoiceDate, @DateFormat, 0, @DateType) InvoiceDate,
			dl.Code DlCode,
			case when @CultureNo = 1 then dl.Title else dl.Title2 end DlTitle,
			p.StuffID,
			s.Code StuffCode,
			case when @CultureNo = 1 then s.Title else s.Title2 end StuffTitle,
			r.Non
		from VND.PurchaseInvoiceItem p
			join VND.PurchaseInvoice i on p.PurchaseInvoiceID = i.PurchaseInvoiceID
			join #vwStuff s on p.StuffID = s.StuffID
			join VND.PurchaseInvoice_PriceRemains r on p.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
			join acc.dl on dl.DLID = i.DlID
		where r.Non > 0 and
			i.BranchID = @BranchId and
			i.Date <= @Date
			and i.Status = 2
	end
END


