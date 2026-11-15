
----------------------------------------------------------------
CREATE   PROCEDURE [FOS].[spGetBillOfLadingItems]
(
 @BranchId int,
 @Date date
)
--WITH ENCRYPTION 
AS
BEGIN

	DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
			@Culture NVARCHAR(100),
			@CultureNo tinyint	   	
 
	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	SELECT @DateType = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Type'
		AND us.UserID = @UserID
	
	IF @DateType IS NULL
		SET @DateType = CASE CFG.GetuserCulture()
                              WHEN 'fa' THEN 0
                              WHEN 'en' THEN 1
                              WHEN 'ar' THEN 2
                            END
	
	SELECT @DateFormat = us.SettingValue
	FROM CFG.UserSetting us
	WHERE us.SettingKey = 'Date_Format'
		AND us.UserID = @UserID;
	
	IF @DateFormat IS NULL
		SET @DateFormat = 'YY/MM/DD'

	SELECT i.BillOfLadingItemID,
           b.BillNumber,
		   i.SharingAmount,
		   CFG.GetCLRSaturnDate(b.IssueDate, @DateFormat, 0, @DateType) PersianIssueDate,
		   s.Code StuffCode,	
		   case @CultureNo
				when 1 then s.Title
				when 2 then s.Title2
			end as StuffTitle,	  
		   pur.CurrencyID,
		   case @CultureNo
				when 1 then cu.Title
				when 2 then cu.Title2
			end as CurrencyName

	FROM FOS.BillOfLadingItem i
	join FOS.BillOfLading b on i.BillOfLadingID = b.BillOfLadingID
	join VND.PurchaseInvoiceItem p on i.PurchaseInvoiceItemID = p.PurchaseInvoiceItemID
	join STF.[VWStuff] s on p.StuffID = s.StuffID
	join VND.PurchaseInvoice pur on p.PurchaseInvoiceID = pur.PurchaseInvoiceID
	join CFG.Currency cu on pur.CurrencyID = cu.CurrencyID
	left join (select BillOfLadingItemID from FOS.ClearanceItem) ci on i.BillOfLadingItemID = ci.BillOfLadingItemID
	where b.BranchID = @BranchId and 
	      b.Date <= @Date and
		  ci.BillOfLadingItemID is null

END;
