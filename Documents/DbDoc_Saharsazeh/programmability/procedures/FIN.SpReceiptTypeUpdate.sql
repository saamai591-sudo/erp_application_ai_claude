CREATE PROC [FIN].[SpReceiptTypeUpdate]
    @ReceiptTypeID INT,
    @Code INT,
    @Type TINYINT,
    @Title NVARCHAR(250),
    @Title2 NVARCHAR(250),
    @SLID INT,
    @IsActive BIT,
    @CompulsoryBaseSelection BIT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @AllocationSLID INT,
    @CashStructureID INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Version <>
    (
        SELECT [Version]
        FROM [FIN].[ReceiptType]
        WHERE [ReceiptTypeID] = @ReceiptTypeID
    )
        RAISERROR('Version mismatch...', 16, 10);

    SET @Version = @Version + 1;

    IF (@Code IS NULL OR @Code = 0)
        SET @Code = ISNULL(
                    (
                        SELECT MAX(Code)FROM FIN.ReceiptType
                    ),
                    0
                          ) + 1;

    UPDATE [FIN].[ReceiptType]
    SET [Code] = @Code,
        [Type] = @Type,
        [Title] = @Title,
        [Title2] = @Title2,
        [SLID] = @SLID,
        [IsActive] = @IsActive,
        [Version] = @Version,
        [CompulsoryBaseSelection] = @CompulsoryBaseSelection,
        [Creator] = @Creator,
        [CreationDate] = @CreationDate,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [AllocationSLID] = @AllocationSLID,
        [CashStructureID]=@CashStructureID
    WHERE [ReceiptTypeID] = @ReceiptTypeID;

    -- Begin Return Select <- do not remove
    SELECT [Version],
           [Code]
    FROM [FIN].[ReceiptType]
    WHERE [ReceiptTypeID] = @ReceiptTypeID;
-- End Return Select <- do not remove
