CREATE PROC [FIN].[SpReceiptTypeInsert]
    @Code INT,
    @Type TINYINT,
    @Title NVARCHAR(250),
    @Title2 NVARCHAR(250),
    @SLID INT,
    @IsActive BIT,
    @CompulsoryBaseSelection BIT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @AllocationSLID INT,
    @CashStructureID INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF (@Type = 8)
    BEGIN
        IF EXISTS (SELECT * FROM FIN.ReceiptType WHERE [Type] = 8)
        BEGIN
            RAISERROR('نوع دریافت از کارتخوان بیشتر از یک مورد نمی تواند باشد.', 16, 12);
            RETURN;
        END;
    END;

    IF (@Code IS NULL OR @Code = 0)
        SET @Code = ISNULL(
                    (
                        SELECT MAX(Code)FROM FIN.ReceiptType
                    ),
                    0
                          ) + 1;

    INSERT INTO [FIN].[ReceiptType]
    (
        [Code],
        [Type],
        [Title],
        [Title2],
        [SLID],
        [IsActive],
        [CompulsoryBaseSelection],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [AllocationSLID],
        [CashStructureID]
    )
    SELECT @Code,
           @Type,
           @Title,
           @Title2,
           @SLID,
           @IsActive,
           @CompulsoryBaseSelection,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           @AllocationSLID,
           @CashStructureID;

    -- Begin Return Select <- do not remove
    SELECT [ReceiptTypeID],
           [Version],
           [Code]
    FROM [FIN].[ReceiptType]
    WHERE [ReceiptTypeID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
