CREATE     PROC [SLE].[spInvoiceItemTraceUpdate]
    @InvoiceItemTraceID INT,
    @InvoiceItemID INT,
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

SELECT @PreDate = [date],
       @PrePrevoucherID = PreVoucherID
FROM sle.Invoice i
WHERE i.InvoiceID =
(
    SELECT TOP 1
           InvoiceID
    FROM sle.InvoiceItem
    WHERE InvoiceItemID = @InvoiceItemID
);

IF @PreDate <=
(
    SELECT MAX(EndDate) FROM cfg.Vat v
)
BEGIN
    RAISERROR('VatHasPublished', 16, 12);
END;


UPDATE [SLE].[InvoiceItemTrace]
SET [TraceID] = @TraceID,
    [DlID] = @DlID,
    [Value] = @Value,
    [Version] = @Version + 1,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate,
    TraceItemID = @TraceItemID
WHERE [InvoiceItemTraceID] = @InvoiceItemTraceID;

-- Begin Return Select <- do not remove
SELECT  [Version] 
FROM [SLE].[InvoiceItemTrace]
WHERE [InvoiceItemTraceID] = @InvoiceItemTraceID;
-- End Return Select <- do not remove
