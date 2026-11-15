CREATE     PROC [SLE].[spReturnedSaleInvoiceItemTraceUpdate]
    @ReturnedSaleInvoiceItemTraceID INT,
    @ReturnedSaleInvoiceItemID INT,
    @TraceID INT,
    @DlID BIGINT,
    @Value NVARCHAR(MAX),
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @TraceItemID INT
--WITH ENCRYPTION
AS
SET NOCOUNT ON;
DECLARE @PreDate DATE,
        @PrePrevoucherID INT,
        @Message NVARCHAR(MAX);

SELECT @PreDate = [Date],
       @PrePrevoucherID = PreVoucherID
FROM SLE.ReturnedSaleInvoice i
WHERE i.ReturnedSaleInvoiceID =
(
    SELECT TOP 1
           ReturnedSaleInvoiceID
    FROM SLE.ReturnedSaleInvoiceItem
    WHERE InvoiceItemID = @ReturnedSaleInvoiceItemID
);

IF @PreDate <=
(
    SELECT MAX(EndDate) FROM CFG.Vat v
)
BEGIN
    RAISERROR('VatHasPublished', 16, 12);
END;

--if @Version <> (Select [Version] from [SLE].[ReturnedSaleInvoiceItemTrace]
--where [ReturnedSaleInvoiceItemTraceID] = @ReturnedSaleInvoiceItemTraceID)
--or @PrePrevoucherID is not null
--RAISERROR('Version mismatch...', 16 , 10)

UPDATE [SLE].[ReturnedSaleInvoiceItemTrace]
SET [TraceID] = @TraceID,
    [DlID] = @DlID,
    [Value] = @Value,
    [Version] = @Version + 1,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate,
    TraceItemID = @TraceItemID
WHERE [ReturnedSaleInvoiceItemTraceID] = @ReturnedSaleInvoiceItemTraceID;

-- Begin Return Select <- do not remove
SELECT  [Version] 
FROM [SLE].[ReturnedSaleInvoiceItemTrace]
WHERE [ReturnedSaleInvoiceItemTraceID] = @ReturnedSaleInvoiceItemTraceID;
-- End Return Select <- do not remove
