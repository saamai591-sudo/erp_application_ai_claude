CREATE     PROC [SLE].[spReturnedSaleInvoiceItemTraceInsert]
    @ReturnedSaleInvoiceItemID INT,
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
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    INSERT INTO [SLE].[ReturnedSaleInvoiceItemTrace]
    (
        [ReturnedSaleInvoiceItemID],
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
    SELECT @ReturnedSaleInvoiceItemID,
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
    SELECT [ReturnedSaleInvoiceItemTraceID],
           [Version]
    FROM [SLE].[ReturnedSaleInvoiceItemTrace]
    WHERE [ReturnedSaleInvoiceItemTraceID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
END
