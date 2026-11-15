CREATE    PROC [CNT].[GetContractStatementDetails]
@ID int
as

DECLARE @UserID        INT,
        @DateType      VARCHAR(10),
        @DateFormat    VARCHAR(10),
        @Culture       VARCHAR(10),
		@CultureNo	   VARCHAR(10),
		@DlID		   BigINt

SET @Culture = CFG.GetuserCulture()

select @CultureNo = CultureNo
from cfg.CultureInfo
where Culture = @Culture


SET @UserID = cfg.GetuserID()

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

SELECT  a.ContractStatementDetailID, 
		a.ContractStatementID, 
		a.RowIndex, 
		a.PartyID, 
		dl.Code PartyCode,
		case when @CultureNo = 1 then d.Title+isnull(' '+d.LastName,'') else d.Title2+isnull(' '+d.LastName2,'')  end PartyName,
		a.BaseDocumentType, 
		a.BaseDocumentID, 
		case when a.BaseDocumentType = 1 then case when @CultureNo = 1 then b.Title else b.Title2 end
		     when a.BaseDocumentType = 2 then 			N'فاکتور شماره '+
				isnull(c.InvoiceNumber,cast(c.number as varchar(25)))+
				N' به تاریخ '+
				CFG.GetCLRSaturnDate(isnull(c.InvoiceDate,c.Date),@DateFormat,0,@DateType) 
				end BaseDocumentTitle,
		a.Date, 
		a.Amount, 
		a.Description, 
		a.Description2, 
		a.Creator, 
		a.CreationDate, 
		a.LastEditor, 
		a.LastEditionDate, 
		a.Version
FROM    CNT.ContractStatementDetail a
left join fin.PaymentType b 
	on a.BaseDocumentType = 1 and  a.BaseDocumentID = b.PaymentTypeID
left join vnd.PurchaseInvoice c
	on a.BaseDocumentType = 2 and  a.BaseDocumentID = c.PurchaseInvoiceID
inner join cfg.Party d
	on a.PartyID = d.PartyID
inner join acc.dl 
	on dl.DLID = d.DlID
where a.ContractStatementID = @ID