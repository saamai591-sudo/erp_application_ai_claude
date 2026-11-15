
--------------------------------------
CREATE   Proc Req.spPaymentRequestReviewDataSource
(
    @SelectedBranchs NVARCHAR(MAX),
    @SelectedOrganizationUnits NVARCHAR(MAX),
    @TableName NVARCHAR (MAX),
    @FromDate DATE,
    @ToDate DATE,
    @SelectedType NVARCHAR(50) = Null,
    @SelectedDocument INT = Null
)
as

DECLARE @Query NVARCHAR(MAX)

---Branch
SELECT
	rfcst.[value] as BranchID  into #SelectedBranchs
FROM
	cfg.R_FnCommaStr2Table(@SelectedBranchs) AS rfcst
	
SELECT vba.* into #vwBranchAccess
FROM cfg.vwBranchAccess AS vba
left join #SelectedBranchs sb on vba.BranchID = sb.BranchID
WHERE (@SelectedBranchs is NULL or sb.BranchID is NOT NULL)
	
---OrganizationUnit	
SELECT
	rfcst.[value] as OrganizationUnitID  into #SelectedOrganizationUnits
FROM
	cfg.R_FnCommaStr2Table(@SelectedOrganizationUnits) AS rfcst
	
SELECT vba.* into #vwOrganizationUnitAccess
FROM cfg.vwOrganizationUnitAccess  AS vba
left join #SelectedOrganizationUnits sb on vba.OrganizationUnitID = sb.OrganizationUnitID
WHERE (@SelectedOrganizationUnits is NULL or sb.OrganizationUnitID is NOT NULL)	


	
set @Query = N'Create table '+@TableName + N'(
       BranchID int,
       OrganizationUnitID int,
       PaymentRequestID int,
       PaymentRequestItemID int,
       PaymentOrderID int,
       PaymentReceiptID int,
       PaymentRequestNumber int,
       PaymentRequestDate Date,
       PaymentRequestAmount decimal (36,10),
       CurrencyID int,
       CurrencyRate decimal (36,10),
       PaymentOrderAmount decimal (36,10),
       PaymentReceiptAmount decimal (36,10))'
       
       EXEC (@Query)
	if ISNULL(@SelectedType,'') = ''
	begin
	
set @Query = N'
INSERT INTO '+@TableName+N'
SELECT pr.BranchID,
       pr.OrganizationUnitID,
       pr.PaymentRequestID,
       pri.PaymentRequestItemID,
       null                         AS PaymentOrderID,
       null                         AS PaymentReceiptID,
       pr.Number                       PaymentRequestNumber,
       pr.[Date]                       PaymentRequestDate,
       pri.Amount                      PaymentRequestAmount,
       c.CurrencyID                         CurrencyID,
       0.0                          AS CurrencyRate,
       0.0                          AS PaymentOrderAmount,
       0.0                          AS PaymentReceiptAmount
FROM   req.PaymentRequest           AS pr
       JOIN req.PaymentRequestItem  AS pri
            ON  pri.PaymentRequestID = pr.PaymentRequestID
       JOIN cfg.Currency            AS c
            ON  c.CurrencyID = pri.CurrencyID
       join      #vwBranchAccess vba on pr.BranchID = vba.BranchID
       join		#vwOrganizationUnitAccess voua on pr.OrganizationUnitID = voua.OrganizationUnitID
       where pr.date between @FromDate and @ToDate'
       
            EXECUTE sp_executesql @query,
      N'@ToDate			datetime,
        @FromDate		datetime,
		@TableName		NVARCHAR(MAX)',
		@ToDate =		@ToDate,
		@FromDate =		@FromDate,
		@TableName =	@TableName
		End
	
	IF ISNULL(@SelectedType, '') IN ('', 'PaymentOrder')
	BEGIN
		
	set @Query = N' 	
INSERT INTO '+@TableName+N'
SELECT po.BranchID                         AS BranchID,
       pr.OrganizationUnitID,
       pri.PaymentRequestID,
       poi.PaymentRequestItemID,
       po.PaymentOrderID,
       null                            PaymentReceiptID,
       pr.Number                            PaymentRequestNumber,
       pr.[Date]                            PaymentRequestDate,
       0                               PaymentRequestAmount,
       c.CurrencyID                         CurrencyID,
       poi.ExchangeRate                          CurrencyRate,
       poi.Price                 PaymentOrderAmount,
       0                            AS PaymentPrice
FROM   req.PaymentOrderItem         AS poi
join req.PaymentOrder AS po on po.PaymentOrderID = poi.PaymentOrderID
       JOIN req.PaymentRequestItem  AS pri
            ON  pri.PaymentRequestItemID = poi.PaymentRequestItemID
            join req.PaymentRequest AS pr on pr.PaymentRequestID = pri.PaymentRequestID
       JOIN cfg.Currency            AS c
            ON  c.CurrencyID = pri.CurrencyID
 join #vwBranchAccess AS vba on pr.BranchID = vba.BranchID 
       join		#vwOrganizationUnitAccess voua on pr.OrganizationUnitID = voua.OrganizationUnitID
       where (@FromDate is null or pr.date between @FromDate and @ToDate)
       and (@SelectedDocument is null or pri. PaymentRequestItemID = @SelectedDocument)'
    
	print @Query
       EXECUTE sp_executesql @query,
      N'@ToDate			datetime,
        @FromDate		datetime,
		@TableName		NVARCHAR(MAX),
		@SelectedDocument int',
		@ToDate =		@ToDate,
		@FromDate =		@FromDate,
		@TableName =	@TableName,
		@SelectedDocument = @SelectedDocument   
       	   
	END

	IF ISNULL(@SelectedType, '') IN ('', 'PaymentReceipt')
	BEGIN	
	set @Query = N'
	INSERT INTO '+@TableName+N'
SELECT pr.BranchID                         AS BranchID,
       pr2.OrganizationUnitID,
       pri.PaymentRequestID,
       poi.PaymentRequestItemID,
       null                            PaymentOrderID,
       pr.PaymentReceiptID,
       pr2.Number                            PaymentRequestNumber,
       pr2.[Date]                            PaymentRequestDate,
       0                               PaymentRequestAmount,
       c.CurrencyID                         CurrencyID,
       poi.ExchangeRate       CurrencyRate,
       0                            AS PaymentOrderAmount,
       poi.Price              AS PaymentPrice
FROM   fin.PaymentReceipt           AS pr
       JOIN req.PaymentOrder        AS po
            ON  po.PaymentOrderID = pr.PaymentOrderID
       JOIN req.PaymentOrderItem    AS poi
            ON  poi.PaymentOrderID = po.PaymentOrderID
       JOIN req.PaymentRequestItem  AS pri
            ON  pri.PaymentRequestItemID = poi.PaymentRequestItemID
            join req.PaymentRequest AS pr2 on pr2.PaymentRequestID = pri.PaymentRequestID
       JOIN fin.PaymentCheqe        AS pc
            ON  pr.PaymentReceiptID = pc.PaymentReceiptID
       JOIN cfg.Currency            AS c
            ON  pri.CurrencyID = c.CurrencyID 
       join #vwBranchAccess AS vba on pr2.BranchID = vba.BranchID  
       join		#vwOrganizationUnitAccess voua on pr2.OrganizationUnitID = voua.OrganizationUnitID
       where (@FromDate is null or  pr2.date between @FromDate and @ToDate)
       and (@SelectedDocument is null or pri.PaymentRequestItemID = @SelectedDocument)
         
UNION ALL


SELECT pr.BranchID                         AS BranchID,
       pr2.OrganizationUnitID,
       pri.PaymentRequestID,
       poi.PaymentRequestItemID,
       null                            PaymentOrderID,
       pr.PaymentReceiptID,
       pr2.Number                            PaymentRequestNumber,
       pr2.[Date]                            PaymentRequestDate,
       0                               PaymentRequestAmount,
       c.CurrencyID                         CurrencyID,
      poi.ExchangeRate                            CurrencyRate,
       0                            AS PaymentOrderAmount,
       poi.Price              AS PaymentPrice
FROM   fin.PaymentReceipt           AS pr
       JOIN req.PaymentOrder        AS po
            ON  po.PaymentOrderID = pr.PaymentOrderID
       JOIN req.PaymentOrderItem    AS poi
            ON  poi.PaymentOrderID = po.PaymentOrderID
       JOIN req.PaymentRequestItem  AS pri
            ON  pri.PaymentRequestItemID = poi.PaymentRequestItemID
            join req.PaymentRequest AS pr2 on pr2.PaymentRequestID = pri.PaymentRequestID
       JOIN fin.PaymentBankDraft         AS pc
            ON  pr.PaymentReceiptID = pc.PaymentReceiptID
       JOIN cfg.Currency            AS c
            ON  pri.CurrencyID = c.CurrencyID 
       Join #vwBranchAccess AS vba on pr2.BranchID = vba.BranchID
       join		#vwOrganizationUnitAccess voua on pr2.OrganizationUnitID = voua.OrganizationUnitID
       where (@FromDate is null or  pr2.date between @FromDate and @ToDate)
       and (@SelectedDocument is null or pri.PaymentRequestItemID = @SelectedDocument) '
    
       
      EXECUTE sp_executesql @query,
      N'@ToDate			datetime,
        @FromDate		datetime,
		@TableName		NVARCHAR(MAX),
		@SelectedDocument int',
		@ToDate =		@ToDate,
		@FromDate =		@FromDate,
		@TableName =	@TableName,
		@SelectedDocument = @SelectedDocument   
	END	
