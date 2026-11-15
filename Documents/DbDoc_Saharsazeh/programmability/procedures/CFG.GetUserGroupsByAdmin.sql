

CREATE   PROCEDURE [CFG].[GetUserGroupsByAdmin]
    (
      @userid INT ,
      @parentId INT = -100
    )
AS
	declare @Culture NVARCHAR(100),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    CREATE TABLE #T ( Id INT );


    INSERT  INTO #T
    SELECT  UserGroupID
    FROM    CFG.UserGroup
    WHERE   UserAdminID = @userid;


    WHILE @@ROWCOUNT <> 0
        BEGIN
            INSERT  INTO #T
                    SELECT  UserGroupID
                    FROM    CFG.UserGroup
                    WHERE   ParentUserGroupID IN ( SELECT   Id
                                                   FROM     #T )
                            AND UserGroupID NOT IN ( SELECT Id
                                                     FROM   #T );

        END;
    
    SELECT  UserGroupID ,
            ( CASE WHEN EXISTS ( SELECT 1
                                 FROM   #T
                                 WHERE  Id = ParentUserGroupID )
                   THEN ParentUserGroupID
                   ELSE NULL
              END ) ParentUserGroupID ,
			case @CultureNo
				when 1 then Title
				when 2 then Title2
			end as Title            
    INTO    #TT
    FROM    CFG.UserGroup
            INNER JOIN #T ON Id = UserGroupID;

    SELECT  *,
    cast(CASE WHEN EXISTS (SELECT 1 FROM #tt tt WHERE tt.ParentUserGroupID=#tt.UserGroupID) 
    THEN 1 ELSE 0 END AS bit)
     HasChildren
     
    FROM    #TT
    WHERE   ParentUserGroupID = @parentId
            OR @parentId = -100
            OR ( @parentId IS NULL
                 AND ParentUserGroupID IS NULL
               );
               
   
    
    

