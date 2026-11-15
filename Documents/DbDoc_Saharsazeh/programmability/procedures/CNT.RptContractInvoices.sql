
-------------Start of #7885
CREATE   PROC [CNT].RptContractInvoices (@Contracts VARCHAR(MAX) = NULL)
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
                        WHEN 'fa' THEN
                            0
                        WHEN 'en' THEN
                            1
                        WHEN 'ar' THEN
                            2
                    END

SELECT @DateFormat = us.SettingValue
FROM cfg.UserSetting us
WHERE us.SettingKey = 'Date_Format'
      AND us.UserID = @UserID

IF @DateFormat IS NULL
    SET @DATEFORMAT = 'YY/MM/DD'


DECLARE @Columns NVARCHAR(MAX),
        @ColumnsInSelectList NVARCHAR(MAX),
        @ColumnsInPayedSelectList NVARCHAR(MAX),
        @query NVARCHAR(MAX),
        @param NVARCHAR(MAX),
        @CodeAndTitleColumn NVARCHAR(MAX),
        @LeftJoin NVARCHAR(MAX)

SELECT @Columns = STUFF(
(
    SELECT DISTINCT
        ',' + QUOTENAME(AdditionDeductionTypeID)
    FROM CNT.AdditionDeductionType
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
1   ,
''
                       )

IF (@Columns IS NULL)
    SET @Columns = '[-1]'

SELECT @ColumnsInSelectList = STUFF(
(
    SELECT DISTINCT
        ',ISNULL(p1.' + QUOTENAME(AdditionDeductionTypeID) + ',0) AS T' + CAST(AdditionDeductionTypeID AS VARCHAR(10))
    FROM CNT.AdditionDeductionType
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
0   ,
''
                                   )

IF (@ColumnsInSelectList IS NULL)
    SET @ColumnsInSelectList = ''

SELECT @ColumnsInPayedSelectList
    = STUFF(
(
    SELECT DISTINCT
        ',ISNULL(p2.' + QUOTENAME(AdditionDeductionTypeID) + ',0) AS PayedT'
        + CAST(AdditionDeductionTypeID AS VARCHAR(10))
    FROM CNT.AdditionDeductionType
    FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),
1   ,
0   ,
''
           )

IF (@ColumnsInPayedSelectList IS NULL)
    SET @ColumnsInPayedSelectList = ''

SELECT *
INTO #vwBranchAccess
FROM cfg.vwBranchAccess

set @query
    = N'	select
		a.PurchaseInvoiceID,
		a.Number ,
		a.Date,
		cfg.GetCLRSaturnDate(a.Date,@DateFormat,0,@DateType) Date_Date ,
		a.InvoiceNumber ,
		a.InvoiceDate,
		cfg.GetCLRSaturnDate(a.InvoiceDate,@DateFormat,0,@DateType) Date_InvoiceDate ,		 
		case when @CultureNo = 1 then Currency.Title else Currency.Title2 end as Currency,
		c.Amount,
		c.Vat,
		c2.Number ContractNumber,
		dl.Code DlCode,
		case when @CultureNo = 1 then dl.Title else dl.Title2 end DlTitle,
		nonpayed.Done+isnull(pip.Done,0) Payed,
		isnull(DepPrepayment,0) DepPrepayment,
		isnull(OnAccount,0) OnAccount
		' + @ColumnsInSelectList + @ColumnsInPayedSelectList
      + '		
 from vnd.PurchaseInvoice a
	INNER JOIN  #vwBranchAccess Branch on Branch.BranchID = a.BranchID
	join acc.dl on dl.DLID = a.DlID
	join vnd.PurchaseInvoice_NonPaymented nonpayed on a.PurchaseInvoiceID = nonpayed.PurchaseInvoiceID
	left join  vnd.VWConfirmPurchaseInvoiceNonePayment pip on pip.PurchaseInvoiceID = a.PurchaseInvoiceID
	join
	(
		SELECT a.PurchaseInvoiceID,
       ContractID,
       SUM(a.Price - Discount)     Amount,
       SUM(tax + duty)             Vat
FROM   vnd.PurchaseInvoiceItem a
       JOIN cnt.VWContractSubject b
            ON  a.ContractSubjectID = b.ContractSubjectID
GROUP BY
       a.PurchaseInvoiceID,
       ContractID
UNION ALL
SELECT pii.PurchaseInvoiceID,
       ContractID,
       SUM(pii.Price - pii.Discount)        Amount,
       SUM(pii.tax + pii.duty)                Vat
FROM   vnd.PurchaseInvoiceItem     AS pii
       JOIN stc.StockReceiptItem   AS sri
            ON  sri.StockReceiptItemID = pii.StockReceiptItemID
       JOIN cnt.VWContractSubject  AS vs
            ON  vs.ContractSubjectID = sri.ContractSubjectID
GROUP BY
       pii.PurchaseInvoiceID,
       ContractID
	)c
		on a.PurchaseInvoiceID = c.PurchaseInvoiceID
	join cfg.Currency
		on Currency.CurrencyID = a.CurrencyID
	left join CNT.Contract AS c2 ON c2.ContractID = c.ContractID
	left join #ContractCurrency T
		on T.ContractID = c.ContractID AND T.CurrencyID =  a.CurrencyID
	left join
	(
		select a.PurchaseInvoiceID,sum(a.Price) DepPrepayment,0 OnAccount
		from vnd.PurchaseInvoicePrePayment a
		join vnd.PurchaseInvoiceItem b
			on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		join cnt.VWContractSubject c
			on b.ContractSubjectID = c.ContractSubjectID
		group by a.PurchaseInvoiceID
		union all
		select  p.PurchaseInvoiceID,
				sum(case when adt.Criterion = 2 then pip.Price else 0 end) DepPrepayment,
				sum(case when adt.Criterion = 3 then pip.Price else 0 end) OnAccount
		from vnd.ConfirmPurchaseInvoiceAdvancePayment pip
		join vnd.ConfirmPurchaseInvoiceItem pi on pi.ConfirmPurchaseInvoiceItemID = pip.ConfirmPurchaseInvoiceItemID
		join vnd.ConfirmPurchaseInvoice p on p.ConfirmPurchaseInvoiceID = pi.ConfirmPurchaseInvoiceID
		join cnt.AdditionDeductionType adt on adt.AdditionDeductionTypeID = pi.AdditionDeductionTypeID
		where adt.Criterion in (2,3)
		group by p.PurchaseInvoiceID

	) DP on DP.PurchaseInvoiceID = a.PurchaseInvoiceID 
	LEFT join
	(
		select AdditionDeductionTypeID,PurchaseInvoiceID,SUM(Deduction-Addition-Paid) Value
		from CNT.ConfirmStatementItem a
		where a.PurchaseInvoiceID is not null
		group by AdditionDeductionTypeID,PurchaseInvoiceID		
		union all
		select AdditionDeductionTypeID,PurchaseInvoiceID,SUM(Deduction-Addition) Value
		from vnd.ConfirmPurchaseInvoiceItem a
		join vnd.ConfirmPurchaseInvoice b on a.ConfirmPurchaseInvoiceID = b.ConfirmPurchaseInvoiceID
		group by AdditionDeductionTypeID,PurchaseInvoiceID		
	)x 
	pivot
	(
	  MAX(value)
	  FOR AdditionDeductionTypeID IN (' + @Columns
      + ')
	)p1 on p1.PurchaseInvoiceID = a.PurchaseInvoiceID
	left join
	(
		select AdditionDeductionTypeID,PurchaseInvoiceID,SUM(Done) Value
		from CNT.vwConfirmStatementItemRemain 
		group by AdditionDeductionTypeID,PurchaseInvoiceID			
		union all
		select AdditionDeductionTypeID,PurchaseInvoiceID,SUM(Done) Value
		from  [VND].[VWConfirmPurchaseInvoiceItemNonePayment]
			group by AdditionDeductionTypeID,PurchaseInvoiceID		
	)x2
	pivot
	(
	  MAX(value)
	  for AdditionDeductionTypeID in (' + @Columns
      + ')
	)p2 on p2.PurchaseInvoiceID = a.PurchaseInvoiceID
		WHERE 
	(
		@Contracts is null 
		OR
		T.ContractID IS NOT NULL
		)
		AND c2.CompanyRoll = 1
		and currency.CurrencyID = a.CurrencyID'

SET @param
    = N'@Contracts  varchar(max),
				   @DateType   TINYINT,
				   @DateFormat VARCHAR(10),
				   @CultureNo  char(1) '

EXECUTE sp_executeSQL @query,
                      @param,
                      @Contracts = @Contracts,
                      @CultureNo = @CultureNo,
                      @DateType = @DateType,
                      @DateFormat = @DateFormat
