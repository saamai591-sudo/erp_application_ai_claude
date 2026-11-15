
-----------------------------------------------------------
CREATE   PROC [CNT].RptReceiptAndPayment (@Contracts VARCHAR(MAX) = NULL)
--WITH ENCRYPTION
AS
CREATE TABLE #ContractCurrency
(
    ContractID INT,
    CurrencyID INT
);

WITH SplitComma
AS (SELECT value AS KeyValuePair
    FROM STRING_SPLIT(@Contracts, ',')
   ),
     SplitHash
AS (SELECT LEFT(KeyValuePair, CHARINDEX('#', KeyValuePair) - 1) AS ContractID,
           RIGHT(KeyValuePair, LEN(KeyValuePair) - CHARINDEX('#', KeyValuePair)) AS CurrencyID
    FROM SplitComma
   )

INSERT INTO #ContractCurrency (ContractID, CurrencyID)
SELECT CAST(ContractID AS INT), CAST(CurrencyID AS INT)
FROM SplitHash;

DECLARE @UserID INT,
        @DateType TINYINT,
        @Culture VARCHAR(10),
        @DateFormat VARCHAR(10),
        @CultureNo tinyint

SET @UserID = CFG.GetuserID()
SET @Culture = cfg.GetuserCulture()

select @CultureNo = CultureNo
from CFG.CultureInfo
where Culture = @Culture

SELECT @DateType = us.SettingValue
FROM cfg.UserSetting us
WHERE us.SettingKey = 'Date_Type'
      AND us.UserID = @UserID

IF @DateType IS NULL
    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
                    END

SELECT @DateFormat = us.SettingValue
FROM cfg.UserSetting us
WHERE us.SettingKey = 'Date_Format'
      AND us.UserID = @UserID

IF @DateFormat IS NULL
    SET @DATEFORMAT = 'YY/MM/DD'

SELECT *
INTO #vwBranchAccess
FROM cfg.vwBranchAccess

	select
		ROW_NUMBER() over(order by a.Type,a.Number) Rno,
		case a.Type when 'payment'
						then case when @Culture = 'fa' then N'پرداخت' else N'Payment' end
				  when 'Receive'
						then case when @Culture = 'fa' then N'دریافت' else N'Receive' end
				  when 'CreditAllocation'
						then case when @Culture = 'fa' then N'تخصیص اعتبار' else N'Credit Allocation' end
				  when 'DebitCreditNote'
						then case when @Culture = 'fa' then N'اعلامیه بدهکار بستانکار' else N'Debit Credit Note' end
    end TypeString,
    a.Type,
    a.DocID,
    a.Number,
    a.Date,
    cfg.GetCLRSaturnDate(a.Date, @DateFormat, 0, @DateType) Date_Date,
    a.BaseDocument,
    a.Amount,
		case when @CultureNo = 1 then a.Description else a.Description2 end Description,
		case when @CultureNo = 1 then Currency.Title else Currency.Title2 end as Currency,
		case ReceiptAndPaymentType when 'DownPayment' then N'پیش پرداخت'
								   when 'OnAccount' then N'علی الحساب'
								   when 'Settlement' then N'تسویه'
								   when 'AdvanceReceive' then N'پیش دریافت'
    end ReceiptAndPaymentType
from CNT.VWReceiptAndPayment a
    join cnt.Contract b
        on a.ContractID = b.ContractID
    JOIN #vwBranchAccess Branch
        on Branch.BranchID = B.BranchID
    join cfg.Currency
        on Currency.CurrencyID = a.CurrencyID
    left join #ContractCurrency T
        on T.ContractID = b.ContractID AND T.CurrencyID = a.CurrencyID
where (
          @Contracts is null
          OR
		  T.ContractID IS NOT NULL
      )
      and a.CurrencyID = Currency.CurrencyID
      AND b.CompanyRoll = 1
      AND a.CurrencyID = Currency.CurrencyID;
