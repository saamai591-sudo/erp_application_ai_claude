
CREATE FUNCTION [CNT].[ContractIsActive] ( @ContractID INT )
RETURNS BIT
AS
    BEGIN

        DECLARE @parentID INT ,
            @dlID INT ,
			@Result BIT  

        SELECT  @parentID = ParentID ,
                @dlID = DLID
        FROM    CNT.Contract
        WHERE   ContractID = @ContractID


        IF @parentID IS NOT NULL
            BEGIN
                SELECT  @dlID = DLID
                FROM    CNT.Contract
                WHERE   ContractID = @parentID
            END

        SELECT @Result = IsActive FROM ACC.DL
		WHERE DLID = @dlID

        RETURN @Result

    END
