
---------------------------------------------------------MODIFY [VND].[GetPurchaseInvoiceItemsForCostOfOrder]------------------------
CREATE    PROCEDURE [VND].[GetPurchaseInvoiceItemsForCostOfOrder]
(
	@Date date,
	@BranchID int,
	@PartyID bigint,
	@CurrencyID int
)
--WITH ENCRYPTION 
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
			@Culture NVARCHAR(5),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SET @UserID = CFG.GetuserID()
	
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

	declare @DlId bigint = null
	select @DlId = DlID from CFG.Party where PartyID = @PartyID

	select p.PurchaseInvoiceItemID,
		   i.Number,
		   CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString,
		   i.InvoiceNumber,
		   i.CurrencyRate,
		   CFG.GetCLRSaturnDate(i.InvoiceDate, @DateFormat, 0, @DateType) InvoiceDate,		   
		   pa.PartyID,
		   d.Code DlCode,
		   case @CultureNo
				when 1 then d.Title
				when 2 then d.Title2
		   end as DlTitle,
		   pr.Non NonReceiptCostInBaseCurrency
	from VND.PurchaseInvoiceItem p
		join VND.PurchaseInvoice i on p.PurchaseInvoiceID = i.PurchaseInvoiceID
		join STF.[Stuff] s on p.StuffID = s.StuffID 
		join acc.dl d on d.dlid = i.dlid
		join cfg.party pa on pa.dlid = d.dlid
		join VND.PurchaseInvoice_PriceRemains pr on p.PurchaseInvoiceItemID = pr.PurchaseInvoiceItemID
	where s.[Type] = 1 and
	      @DlId is not null and
		  i.DlID = @DlId and
	      pr.Non > 0 and
		  i.Date <= @Date and
		  i.BranchID = @BranchID and
		  i.CurrencyID = @CurrencyID
	     
END;
