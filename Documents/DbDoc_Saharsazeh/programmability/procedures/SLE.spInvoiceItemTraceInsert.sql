CREATE     PROC [SLE].[spInvoiceItemTraceInsert]
    @InvoiceItemID INT,
    @TraceID INT,
    @DlID BIGINT,
    @Value NVARCHAR(MAX),
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @TraceItemID INT
--WITH ENCRYPTION
AS
SET NOCOUNT ON;
SET XACT_ABORT ON;


INSERT INTO [SLE].[InvoiceItemTrace]
(
    [InvoiceItemID],
    [TraceID],
    [DlID],
    [Value],
    [Version],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    TraceItemID
)
SELECT @InvoiceItemID,
       @TraceID,
       @DlID,
       @Value,
       0,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       @TraceItemID;

-- Begin Return Select <- do not remove
SELECT [InvoiceItemTraceID],
       [Version]
FROM [SLE].[InvoiceItemTrace]
WHERE [InvoiceItemTraceID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
