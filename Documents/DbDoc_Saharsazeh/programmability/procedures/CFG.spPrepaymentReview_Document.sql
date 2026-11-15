------------------------------------- START #7336

CREATE   PROC CFG.spPrepaymentReview_Document
(@ToDate DATE,
@DlCurrencyFilter NVARCHAR (Max))

as

DECLARE @DateType       NVARCHAR(20),
        @DateFormat     NVARCHAR(20)

SET @DateType = cfg.GetCurrentUserDateType()
SET @DateFormat = cfg.GetCurrentUserDateFormat()

SELECT *
INTO   #vwBranchAccess
FROM   cfg.vwBranchAccess AS vba

begin
create table #DlCurrencyFilter
(DlID int,
 CurrencyID int)
 
 insert into #DlCurrencyFilter
select [CFG].[GetStringPartBySpliter](value,1,'|') as DlID ,
	[CFG].[GetStringPartBySpliter](value,2,'|') StuffID 
from [CFG].[Split] (@DlCurrencyFilter,',')
END

SELECT *
INTO   #vwEnums
FROM   cfg.VwEnums AS ve
WHERE  ve.Enum = 'SystemEntities'

SELECT b.Title                        BranchTitle,
       ve.[Value]                     DocumentTitle,
       vppds.DocumentNumber,
       cfg.GetCLRSaturnDate(vppds.DocumentDate, @DateFormat, 0, @dateType) DocumentDate,
       d.Code                         DlCode,
       d.Title                        DlTitle,
       c.Title                        CurrencyTitle,
       c.Title2                       CurrencyTitle2,
       vppds.Amount,
       da.DepreciatedAmount,
       vppds.Amount - da.DepreciatedAmount AS Remain,
       vppds.[Document],
       vppds.DocumentID,
       vppds.DocumentItemID
FROM   cfg.vwPrePaymentDataSource  AS vppds
       JOIN #vwEnums               AS ve
            ON  vppds.[Document] = ve.Item
       JOIN cfg.Currency           AS c
            ON  c.CurrencyID = vppds.CurrencyID
       JOIN (
                SELECT SUM(vppds2.DepreciatedAmount) DepreciatedAmount,
                       vppds2.BaseDocumentItemID
                FROM   cfg.vwPrePaymentDataSource AS vppds2
                WHERE  vppds2.DepreciatedAmount > 0
                GROUP BY
                       vppds2.BaseDocumentItemID
            ) da
            ON  vppds.DocumentItemID = da.BaseDocumentItemID
       JOIN cfg.vwBranchAccess     AS vba
            ON  vba.BranchID = vppds.BranchID
       JOIN cfg.Branch             AS b
            ON  b.BranchID = vba.BranchID
       JOIN acc.DL                 AS d
            ON  d.DLID = vppds.DLID
            
        left join #DlCurrencyFilter dcf on vppds.CurrencyID = dcf.CurrencyID and vppds.DLID = dcf.DlID     
WHERE  vppds.Amount > 0
       AND vppds.DocumentDate <= @ToDate
       and (@DlCurrencyFilter is NULL or dcf.DlID is NOT NULL) 
