CREATE   PROC [ACC].[spDLInsert]
    @DlTypeID INT ,
    @Code VARCHAR(100) ,
    @ParentID BIGINT ,
    @Title NVARCHAR(256) ,
    @Title2 NVARCHAR(256) ,
    @IsActive BIT ,
    @Creator INT ,
    @CreationDate DATETIME
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON 
 
    DECLARE @Message NVARCHAR(MAX)

    DECLARE @dlLenth INT ,
        @receivedCodeLenth INT

    SELECT  @dlLenth =dt.CodeLength
    FROM acc.DlType AS dt
    WHERE dt.DlTypeID=@DlTypeID

    IF @dlLenth IS NULL
        BEGIN 
            SELECT  @Message = 'DlCodeLengthNotSetInConfiguration'
            RAISERROR(@Message,16,12)
            RETURN 0;
        END 

    SET @receivedCodeLenth = LEN(@Code)

    IF @receivedCodeLenth > @dlLenth
        BEGIN
            SELECT  @Message ='DlCodeLengthNotInRange'
            RAISERROR(@Message,16,12)
            RETURN 0;
        END
        
    DECLARE @IsManual BIT ,
			@FirstNumber BIGINT ,
			@LastNumber BIGINT

    SELECT  @IsManual = IsManual ,
            @FirstNumber = FirstNumber ,
            @LastNumber = LastNumber
    FROM    [ACC].[DlType]
    WHERE   DlTypeID = @DlTypeID
	
	IF @LastNumber IS NULL
			SET @LastNumber= REPLACE( REPLACE(STR('',@dlLenth),' ',9),'0','9')

    IF @IsManual=0
        OR @Code IS NULL
         OR @Code = '0'
       
        BEGIN			
            SELECT @Code = isnull( Max(cast(Code AS BIGINT))+1 , @FirstNumber)
			FROM Acc.DL d 
			WHERE CAST(code AS BIGINT) BETWEEN @FirstNumber AND @LastNumber                    
        END
	
    IF @Code>@LastNumber OR @Code<@FirstNumber
	BEGIN
		SELECT  @Message =  'ACC_spDLInsert_3'
        RAISERROR(@Message,16,12)
        RETURN 0;
	END
    
    IF LEN(@Code) > @dlLenth
    BEGIN
        RAISERROR('طول کد این تفصیل بزرگتر از طول تعیین شده است. ',16,12)
        RETURN 0;
    END

	IF EXISTS  ( SELECT 1
                FROM   ACC.DL
                WHERE  Code  = @Code) 
    BEGIN
        SELECT  @Message = 'ACC_spDLInsert_2'
        RAISERROR(@Message,16,12)
        RETURN 0;
    END

    SET @Code = REPLACE(STR(@Code, @dlLenth), ' ', 0)

	if exists(
				select 1
				from ACC.DL
				where Title = @Title
			 )
	begin
		SELECT  @Message =  'DlTitle_Duplicated'
        RAISERROR(@Message,16,12)
        RETURN 0;
	end
	
    INSERT  INTO [ACC].[DL]
            ( [DlTypeID] ,
              [Code] ,
              [ParentID] ,
              [Title] ,
              [Title2] ,
              [IsActive] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate]
            )
            SELECT  @DlTypeID ,
                    @Code ,
                    @ParentID ,
                    @Title ,
                    @Title2 ,
                    @IsActive ,
                    5 ,
                    @Creator ,
                    @CreationDate ,
                    @Creator ,
                    @CreationDate
	
	-- Begin Return Select <- do not remove
    SELECT  [DLID] ,
            [Version] ,
            [Code]
    FROM    [ACC].[DL]
    WHERE   [DLID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
