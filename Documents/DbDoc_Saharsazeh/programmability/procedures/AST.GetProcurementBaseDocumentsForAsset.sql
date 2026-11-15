
create   proc [AST].[GetProcurementBaseDocumentsForAsset]
(
@BaseType varchar(50),
@Type tinyint,
@Date Date,
@BranchID int
)
as
begin


    DECLARE @DateType VARCHAR(10) ,
            @DateFormat VARCHAR(10) ,
            @UserID INT ,
            @Culture VARCHAR(10);


    SET @Culture = CFG.GetuserCulture();
    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;
    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                             WHEN 'fa' THEN 0
                             WHEN 'en' THEN 1
                             WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

if @BaseType = 'Adjustment'
begin

	if @Type = 2
		select  p.PurchaseInvoiceItemID DocumentID,
				isnull(InvoiceNumber,Number) Number,
				dl.Title Party,
				s.Title Description,			   
				r.Non    Remain            
		from VND.PurchaseInvoiceItem p
		join VND.PurchaseInvoice i on p.PurchaseInvoiceID = i.PurchaseInvoiceID	
		join STF.[Stuff] s on p.StuffID = s.StuffID 		
		join VND.PurchaseInvoice_PriceRemains r on p.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
		join acc.dl on dl.DLID = i.DlID
		where r.Non > 0 and 
				i.BranchID = @BranchId and 
				i.Date <= @Date
				and i.Status = 2

	
	if @Type = 3
		select  a.ContractStatementItemID DocumentID,
				c.Number,
				dl.Title Party,
				a.Description,
				r.Remain
		from cnt.ContractStatementItem a
		join cnt.ContractStatement b
			on a.ContractStatementID = b.ContractStatementID
		join cnt.ConfirmStatement c
			on b.ContractStatementID = c.ContractStatementID
		join cfg.Party d
			on d.PartyID = b.PartyID
		join acc.dl 
			on dl.DLID = d.DlID
		join cnt.Contract e
			on e.ContractID = b.ContractID
		join cnt.VwContractStatementItem_Remain r
			on r.ContractStatementItemID = a.ContractStatementItemID
		where c.Date <= @Date
		and   e.BranchID = @BranchID
		and r.Remain > 0

end
end