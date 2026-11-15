
------------------------------------------------------------
CREATE   PROC [CNT].RptContractGarantees (@Contracts VARCHAR(MAX) = NULL)
--WITH ENCRYPTION
AS
DECLARE @UserID INT,
        @DateType TINYINT,
        @Culture VARCHAR(10),
        @DateFormat VARCHAR(10),
        @CultureNo tinyint

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
INSERT INTO #ContractCurrency
(
    ContractID,
    CurrencyID
)
SELECT CAST(ContractID AS INT),
       CAST(CurrencyID AS INT)

FROM SplitHash;

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
		ROW_NUMBER() over(order by DocName,DocID) Rno,
		case when DocName = 'ReceiveCommitment'        then case when @Culture = 'fa' then N'دریافت تضمین'				else N'Receive Commitment' end
			 when DocName = 'ReceiveCommitmentRecall'  then case when @Culture = 'fa' then N'استرداد تضمین دریافتی'  else N'Receive Commitment Recall' end
			 when DocName = 'Revoke'                   then case when @Culture = 'fa' then N'ابطال' 				    else N'Revoke' end
			 when DocName = 'Deduction'                then case when @Culture = 'fa' then N'تقلیل' 				    else N'Deduction' end
			 when DocName = 'PaymentCommitment'        then case when @Culture = 'fa' then N'پرداخت تضمین'			    else N'Payment Commitment' end
			 when DocName = 'PaymentCommitmentRecall'  then case when @Culture = 'fa' then N'استرداد تضمین پرداختی'	else N'Payment Commitment Recall' end
       end Type,
       DocName,
       DocID,
       b.DocNumber,
       b.Date,
       cfg.GetCLRSaturnDate(b.Date, @DateFormat, 0, @DateType) Date_Date,
       b.ItemType,
       b.ItemNumber,
		case when @CultureNo = 1 then Currency.Title else Currency.Title2 end as Currency,
       b.Amount,
		case when @CultureNo = 1 then ct.Title else ct.Title2 end as CommitmentType
		
from CNT.VWContractCommitment b
    join cnt.Contract c
        on b.ContractID = c.ContractID
    JOIN #vwBranchAccess Branch
        on Branch.BranchID = C.BranchID
    join cfg.currency
        on currency.CurrencyID = b.CurrencyID
    join fin.CommitmentType ct
        on ct.CommitmentTypeID = b.CommitmentTypeID
    left join #ContractCurrency T
        on T.ContractID = b.ContractID AND T.CurrencyID =  b.CurrencyID
where c.CompanyRoll = 1
      AND (
              @Contracts IS NULL
              OR T.ContractID IS NOT NULL
          )
      AND b.CurrencyID = Currency.CurrencyID;
