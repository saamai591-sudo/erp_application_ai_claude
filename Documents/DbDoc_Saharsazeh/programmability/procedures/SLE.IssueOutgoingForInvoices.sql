
CREATE   PROC [SLE].[IssueOutgoingForInvoices]
(
    @InvoiceIDs NVARCHAR(MAX)
  , @StockID INT
  , @StockDocumentTypeBaseEntityID INT
  , @FinancialPeriodId INT
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @table TABLE ([InvoiceID] INT NOT NULL, [Number] INT NOT NULL);
    CREATE TABLE [#Errors] ([Message] NVARCHAR(MAX) NOT NULL, [IsDetail] BIT NOT NULL DEFAULT (0));
    DECLARE @InvoiceIdTable TABLE ([InvoiceID] INT NOT NULL);
    DECLARE @FinalStuffInventoryErrors NVARCHAR(MAX);
    SET @FinalStuffInventoryErrors = [CFG].[getTempTableName](1);

    INSERT @InvoiceIdTable
    SELECT
        [VALUE]
    FROM [CFG].R_FnStr2TableBySplitor(@InvoiceIDs, ',');


    SELECT
        [I].[InvoiceID]
      , [I].[Number]
    INTO
        [#Tmp_ServiceStuff]
    FROM
        @InvoiceIdTable AS [IIT]
        INNER JOIN [SLE].[Invoice] AS [I] ON [I].[InvoiceID] = [IIT].[InvoiceID]
    WHERE NOT EXISTS (
                         SELECT
                             1
                         FROM
                             [SLE].[InvoiceItem] AS [II]
                             INNER JOIN [STF].[Stuff] AS [S] ON [S].[StuffID] = [II].[StuffID]
                         WHERE
                             [II].[InvoiceID] = [IIT].[InvoiceID] AND [S].[Type] = 0
                     );



    IF EXISTS (SELECT 1 FROM [#Tmp_ServiceStuff])
    BEGIN
        INSERT INTO [#Errors] ([Message], [IsDetail])
        SELECT
            CAST([Number] AS NVARCHAR(MAX)) AS [Message]
          , 1 AS [IsDetail]
        FROM [#Tmp_ServiceStuff];

        INSERT INTO [#Errors] ([Message], [IsDetail])
        VALUES
            (N'SaleManager.Messages.CannotIssuePaymentRequestForServiceInvoice', 0);

        SELECT
            [Message]
          , [IsDetail]
        FROM [#Errors];

        RETURN 0;
    END;



    SELECT
        [I].[InvoiceID]
      , [I].[Number]
    INTO
        [#tmp_SerialedStuff]
    FROM
        @InvoiceIdTable AS [IIT]
        INNER JOIN [SLE].[Invoice] AS [I] ON [I].[InvoiceID] = [IIT].[InvoiceID]
    WHERE
        EXISTS (
                   SELECT
                       1
                   FROM
                       [SLE].[InvoiceItem] [II]
                       INNER JOIN [STF].[StuffDetail] [SD] ON [SD].[StuffID] = [II].[StuffID]
                   WHERE
                       [IIT].[InvoiceID] = [II].[InvoiceID] AND [SD].[IsStuffSerializable] = 1
               );



    IF EXISTS (SELECT 1 FROM [#tmp_SerialedStuff])
    BEGIN
        INSERT INTO [#Errors] ([Message], [IsDetail])
        SELECT
            CAST([Number] AS NVARCHAR(MAX)) AS [Message]
          , 1 AS [IsDetail]
        FROM [#tmp_SerialedStuff];


        INSERT INTO [#Errors] ([Message], [IsDetail])
        VALUES
            ('SaleManager.Messages.CannotIssueOutgoingPaymentRequestForSerializedItems', 0);

        SELECT
            [Message]
          , [IsDetail]
        FROM [#Errors];

        RETURN 0;
    END;

    INSERT INTO @table
    SELECT
        [I].[InvoiceID]
      , [I].[Number]
    FROM
        [SLE].[Invoice] [I]
        INNER JOIN @InvoiceIdTable [IIT] ON [IIT].[InvoiceID] = [I].[InvoiceID]
        INNER JOIN [SLE].[InvoiceItem] [II] ON [II].[InvoiceID] = [I].[InvoiceID] AND [II].[OutgoingItemId] IS NOT NULL;


    INSERT INTO @table
    SELECT
        [a].[InvoiceID]
      , [a].[Number]
    FROM
        [STC].[Outgoing] [O]
        INNER JOIN [STC].[OutgoingItem] [OI] ON [OI].[OutgoingID] = [O].[OutgoingID]
        INNER JOIN (
                       SELECT
                           [II].[InvoiceItemID]
                         , [i].[Number]
                         , [i].[InvoiceID]
                       FROM
                           [SLE].[Invoice] [i]
                           INNER JOIN [SLE].[InvoiceItem] [II] ON [II].[InvoiceID] = [i].[InvoiceID]
                           INNER JOIN @InvoiceIdTable [IIT] ON [IIT].[InvoiceID] = [i].[InvoiceID]
                   ) [a] ON [a].[InvoiceItemID] = [OI].[InvoiceItemID];


    IF EXISTS (SELECT 1 FROM @table)
    BEGIN
        INSERT INTO [#Errors] ([Message], [IsDetail])
        SELECT
            CAST([Number] AS NVARCHAR(MAX)) AS [Message]
          , 1 AS [IsDetail]
        FROM @table;

        INSERT INTO [#Errors] ([Message], [IsDetail])
        VALUES
            (N'SaleManager.Messages.OutgoIssueAlreadyIssuedForInvoice', 0);

        SELECT
            [Message]
          , [IsDetail]
        FROM [#Errors];
        RETURN 0;
    END;


    DECLARE @UserID INT = [CFG].[GetuserID]();

    DECLARE @ItemCount INT = ISNULL((SELECT COUNT(*)FROM @InvoiceIdTable), 0);

    DECLARE
        @Date DATE
      , @DeliverDlID BIGINT
      , @TotalPrice DECIMAL
      , @PartyId BIGINT
      , @CreationDate DATETIME
      , @id INT
      , @Number INT
      , @type BIT;

    WHILE @ItemCount <> 0
    BEGIN

        SELECT TOP (1)
               @id = [InvoiceID]
        FROM @InvoiceIdTable
        ORDER BY [InvoiceID] ASC;


        --SELECT Date,
        --       TotalPrice,
        --       CustomerID,
        --       Number
        --FROM SLE.Invoice
        --WHERE InvoiceID = @id;

        SELECT
            @Date = [I].[Date]
          , @TotalPrice = [I].[TotalPrice]
          , @PartyId = [I].[CustomerID]
          , @Number = [I].[Number]
          , @type = [ST].[Type]
        FROM
            [SLE].[Invoice] AS [I]
            INNER JOIN [SLE].[SaleType] AS [ST] ON [ST].[SaleTypeID] = [I].[SaleTypeID]
        WHERE [I].[InvoiceID] = @id;


        SELECT
            @DeliverDlID = [DlID]
        FROM [CFG].[Party]
        WHERE [PartyID] = @PartyId;

        SET @CreationDate = GETDATE();

        DECLARE @OutgoingTemp TABLE ([OutgoingID] INT, [Number] INT, [Version] INT);


        INSERT @OutgoingTemp
        EXEC [STC].[spOutgoingInsert]
            @AutoGenerated = 0
          , @StockDocumentTypeBaseEntityID = @StockDocumentTypeBaseEntityID
          , @Number = 0
          , @Date = @Date
          , @StockID = @StockID
          , @DeliverDlID = @DeliverDlID
          , @DeliverStockID = NULL
          , @FinancialPeriodID = @FinancialPeriodId
          , @PreVoucherID = NULL
          , @Creator = @UserID
          , @CreationDate = @CreationDate
          , @TotalPrice = 0;

        DECLARE
            @OutgoingId INT
          , @Description NVARCHAR(MAX) = N'خروج انبار بابت فاکتور شماره ' + CAST(@Number AS NVARCHAR(20)) + N' رديف ';

        SELECT
            @OutgoingId = [OutgoingID]
        FROM @OutgoingTemp;

        INSERT [STC].[OutgoingItem]
            (
                [OutgoingID]
              , [RowIndex]
              , [InvoiceItemID]
              , [StuffID]
              , [MainQuantity]
              , [SubQuantity]
              , [Description]
              , [Description2]
              , [Version]
              , [Creator]
              , [CreationDate]
              , [LastEditor]
              , [LastEditionDate]
              , [Fee]
              , [Price]
            )
        SELECT
            @OutgoingId
          , ROW_NUMBER() OVER (ORDER BY [I].[InvoiceItemID])
          , [I].[InvoiceItemID]
          , [I].[StuffID]
          , [IR].[Non]
          , [IR].[NonSub]
          , @Description + CAST([I].[RowIndex] AS NVARCHAR(10))
          , @Description + CAST([I].[RowIndex] AS NVARCHAR(10))
          , 0
          , @UserID
          , GETDATE()
          , @UserID
          , GETDATE()
          , 0
          , 0
        FROM
            [SLE].[InvoiceItem] [I]
            INNER JOIN [SLE].[Invoice_Remains] AS [IR] ON [IR].[InvoiceItemID] = [I].[InvoiceItemID]
            JOIN [STF].[Stuff] [S] ON [S].[StuffID] = [I].[StuffID] AND [S].[Type] = 0
        WHERE [I].[InvoiceID] = @id;

        INSERT [STC].[OutgoingItemTrace]
            (
                [OutgoingItemID]
              , [TraceID]
              , [DlID]
              , [Value]
              , [Version]
              , [Creator]
              , [CreationDate]
              , [LastEditor]
              , [LastEditionDate]
              , [TraceItemID]
            )
        SELECT
            [OI].[OutgoingItemID]
          , [IIT].[TraceID]
          , [IIT].[DlID]
          , [IIT].[Value]
          , 0
          , @UserID
          , GETDATE()
          , @UserID
          , GETDATE()
          , [IIT].[TraceItemID]
        FROM
            [STC].[OutgoingItem] [OI]
            JOIN [SLE].[InvoiceItem] [II] ON [II].[InvoiceItemID] = [OI].[InvoiceItemID]
            JOIN [SLE].[InvoiceItemTrace] [IIT] ON [IIT].[InvoiceItemID] = [II].[InvoiceItemID]
        WHERE [II].[InvoiceID] = @id;

        DECLARE @OutgoingItemIds NVARCHAR(MAX);

        SELECT
            @OutgoingItemIds = STUFF((
                                         SELECT
                                             ',' + CAST([OI].[OutgoingItemID] AS NVARCHAR(20))
                                         FROM
                                             [STC].[OutgoingItem] [OI]
                                             JOIN [STC].[Outgoing] [O] ON [O].[OutgoingID] = [OI].[OutgoingID]
                                         WHERE [O].[OutgoingID] = @OutgoingId
                                         FOR XML PATH(''), TYPE
                                     ).[value]('.', 'NVARCHAR(MAX)')
                                   , 1
                                   , 1
                                   , ''
                                    );


        EXEC [STC].[SpFinalStuffInventory]
            @ID = @OutgoingItemIds -- int
          , @EntityName = N'OutgoingItem' -- nvarchar(500)
          , @Confirmed = 2 -- tinyint
          , @IsDeleteOperation = 0 -- bit
          , @HeaderIDs = NULL -- nvarchar(MAX)
          , @ControlType = 0 -- bit
          , @RecountingInvetoryID = NULL -- int
          , @InventoryEditionID = NULL -- int
          , @ErrorTable = @FinalStuffInventoryErrors;



        EXEC (N'insert into [#Errors] select * from ' + @FinalStuffInventoryErrors);

        IF OBJECT_ID('tempdb..' + @FinalStuffInventoryErrors) IS NOT NULL
            EXEC (N'DROP TABLE ' + @FinalStuffInventoryErrors);


        IF EXISTS (SELECT 1 FROM [#Errors] [E])
        BEGIN
            SELECT
                [E].[Message]
              , [E].[IsDetail]
            FROM [#Errors] [E];

            RETURN 0;
        END;

        DELETE @InvoiceIdTable
        WHERE [InvoiceID] = @id;

        SET @ItemCount = @ItemCount - 1;

        SELECT
            [Message]
          , [IsDetail]
        FROM [#Errors];
    END;
END;

