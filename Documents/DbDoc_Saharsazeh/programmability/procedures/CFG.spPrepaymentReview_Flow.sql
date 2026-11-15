       
CREATE    PROC CFG.spPrepaymentReview_Flow
(@BaseDocumentItemID INT)
as

DECLARE @DateType       NVARCHAR(20),
        @DateFormat     NVARCHAR(20)

SET @DateType = cfg.GetCurrentUserDateType()
SET @DateFormat = cfg.GetCurrentUserDateFormat()


SELECT *
INTO   #vwEnums
FROM   cfg.VwEnums AS ve
WHERE  ve.Enum = 'SystemEntities'


SELECT 
ve.[Value] DocumentTitle,
vppds.DocumentNumber,
cfg.GetCLRSaturnDate(vppds.DocumentDate,@DateFormat,@dateType,0) DocumentDate,
vppds.DepreciatedAmount ,
       vppds.[Document],
       vppds.DocumentID
FROM   cfg.vwPrePaymentDataSource  AS vppds
       join #vwEnums AS ve on vppds.[Document] = ve.Item
       
WHERE vppds.BaseDocumentItemID = @BaseDocumentItemID   
and vppds.DocumentItemID <> vppds.BaseDocumentItemID
